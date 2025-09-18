// src/app/services/ticket-service.ts
import { Injectable } from '@angular/core';

type TicketItem = { nombre: string; cantidad: number; precioUnit: number };

export interface TicketVentaDatos {
  // NUEVO: marca fija arriba (opcional; default = REVOLUCIÓN ATLÉTICA)
  brandTitle?: string;

  negocio: { nombre?: string; direccion?: string; telefono?: string };
  folio: string | number;
  fecha: string | Date;
  cajero: string;
  socio?: string;

  items: TicketItem[];
  totales: { subtotal: number; total: number };

  // Se imprime a la derecha del ticket en vertical (opcional)
  leyendaLateral?: string;

  // NUEVO: para mostrar debajo del total
  tipoPago?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private monto = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

  private fechaFmt(d: string | Date): string {
    const f = d instanceof Date ? d : new Date(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(f.getDate())}/${pad(f.getMonth() + 1)}/${f.getFullYear()} ${pad(f.getHours())}:${pad(f.getMinutes())}`;
  }

  private plantillaVentaHTML(d: TicketVentaDatos): string {
    const brand = (d.brandTitle ?? 'REVOLUCIÓN ATLÉTICA').toUpperCase();
    const negocio = d.negocio ?? {};
    const itemsHtml = (d.items ?? [])
      .map(it => {
        const imp = this.monto((it.cantidad ?? 0) * (it.precioUnit ?? 0));
        const qty = String(it.cantidad ?? 0).padStart(2, ' ');
        return `
          <div class="row item">
            <div class="left">${qty} × ${it.nombre ?? ''}</div>
            <div class="right">${imp}</div>
          </div>`;
      })
      .join('');

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ticket ${d.folio ?? ''}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: 80mm auto; margin: 0; }
    body { margin:0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    .ticket { width: 78mm; padding: 10px 8px 14px; }
    .center { text-align: center; }
    .muted { color: #555; font-size: 12px; }
    .brand { font-weight: 800; font-size: 16px; letter-spacing: .5px; }
    .head-small { margin-top: 2px; }
    .sep { border-top: 1px dashed #999; margin: 8px 0; }
    .row { display: flex; align-items: flex-start; justify-content: space-between; font-size: 13px; }
    .row.item { margin: 2px 0; }
    .left { flex: 1 1 auto; padding-right: 8px; }
    .right { flex: 0 0 auto; text-align: right; min-width: 60px; }
    .totals .row { font-weight: 700; font-size: 14px; }
    .foot { margin-top: 10px; font-size: 12px; }
    .folio-line { font-size: 13px; margin-top: 4px; }
    .vertical-note {
      position: fixed; right: -28px; top: 40%; transform: rotate(90deg);
      font-size: 10px; color: #777; letter-spacing: .2px;
    }
  </style>
</head>
<body>
  ${d.leyendaLateral ? `<div class="vertical-note">${d.leyendaLateral}</div>` : ''}

  <div class="ticket">
    <!-- ENCABEZADO -->
    <div class="center brand">${brand}</div>
    <div class="center head-small muted">
      ${negocio.nombre ?? ''}<br/>
      ${negocio.direccion ?? ''}<br/>
      ${negocio.telefono ? 'TEL: ' + negocio.telefono : ''}
    </div>
    <div class="center folio-line">FOLIO: <strong>${d.folio ?? ''}</strong></div>
    <div class="center muted">${this.fechaFmt(d.fecha)}</div>
    <div class="sep"></div>

    <!-- CUERPO -->
    ${itemsHtml || '<div class="row"><div class="left">—</div><div class="right">$0.00</div></div>'}

    <div class="sep"></div>
    <div class="totals">
      <div class="row"><div class="left">TOTAL</div><div class="right">${this.monto(d.totales?.total ?? 0)}</div></div>
    </div>

    <!-- NUEVO: TIPO DE PAGO -->
    ${
      d.tipoPago
        ? `<div class="row" style="margin-top:4px;"><div class="left">Tipo de pago</div><div class="right">${String(d.tipoPago).toUpperCase()}</div></div>`
        : ''
    }

    <div class="sep"></div>
    <div class="foot">
      <div>CAJERO: ${d.cajero ?? ''}</div>
      ${d.socio ? `<div>SOCIO: ${d.socio}</div>` : ''}
      <div class="center" style="margin-top:8px;">¡Gracias por su compra!</div>
    </div>
  </div>

  <script>
    // Intento de apertura de diálogo de impresión
    setTimeout(() => { try { window.print(); } catch(e){} }, 200);
  </script>
</body>
</html>
    `;
  }

  /** Abre una pestaña con el HTML del ticket (el navegador puede pedir permisos de popup) */
  verVentaComoHtml(data: TicketVentaDatos): void {
    const html = this.plantillaVentaHTML(data);
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (win && win.document) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      // Si bloquearon popups: descarga el .html
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${String(data.folio ?? 'venta')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
