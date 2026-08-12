// src/app/shared/ticket/ticket-print.ts
// Servicio delgado de impresión: toda la plomería de Electron IPC / window.open / descarga.
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TicketPrintService {
  abrirYImprimir(html: string, nombreArchivo: string) {
    const sanitized = html.replace('onload="window.print();window.close();"', '');
    const electronApi = (window as any)?.electron;
    if (electronApi?.printTicket) {
      const preferred = localStorage.getItem('ra_printer_name') || undefined;
      electronApi
        .printTicket(sanitized, preferred)
        .catch((err: any) => console.error('[TicketPrintService] print:', err));
      return;
    }
    const win = window.open('', '_blank', 'width=330,height=600,noopener,noreferrer');
    if (!win) {
      this.descargarHtml(nombreArchivo, sanitized);
      return;
    }
    win.document.open();
    win.document.write(sanitized);
    win.document.close();
    const doPrint = () => {
      try {
        win.focus();
        win.print();
      } finally {
        setTimeout(() => win.close(), 300);
      }
    };
    if (win.document.readyState === 'complete') setTimeout(doPrint, 100);
    else win.addEventListener('load', () => setTimeout(doPrint, 100));
  }

  /**
   * `debug` agrega `data-debug="1"` al <body> para distinguir previews en DOM.
   * `verCorteComoHtml` (único caso legado) lo pasa en false — comportamiento preexistente.
   */
  verComoHtml(html: string, nombre: string, debug = true) {
    let h = html.replace('onload="window.print();window.close();"', '');
    if (debug) h = h.replace('<body', '<body data-debug="1"');
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      this.descargarHtml(nombre, h);
      return;
    }
    w.document.open();
    w.document.write(h);
    w.document.close();
  }

  descargarHtml(nombre: string, html: string) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre || 'ticket.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
