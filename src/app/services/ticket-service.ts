// src/app/services/ticket-service.ts
import { Injectable } from '@angular/core';

// ===== Tipos de ticket =====
export type TicketTipo = 'VENTA' | 'MEMBRESIA' | 'ENTRENADOR';

// Comunes
export interface TicketHeader {
  negocio: {
    nombre: string;
    direccion?: string;
    telefono?: string;
  };
  folio?: string | number;
  fecha: Date | string;
  cajero?: string;
  socio?: string;     // opcional (p.ej. nombre del socio)
}

// Item y totales
export interface TicketItem {
  nombre: string;
  cantidad: number | string;
  precioUnit: number | string;
}
export interface TicketTotales {
  subtotal?: number | string;
  descuento?: number | string;
  total: number | string;
}

// Venta
export interface TicketVenta extends TicketHeader {
  items: TicketItem[];
  totales: TicketTotales;
  leyendaLateral?: string;   // leyenda vertical
  brandTitle?: string;       // encabezado fijo arriba (ej. "REVOLUCIÓN ATLÉTICA")
  tipoPago?: string;         // se muestra bajo el total
}

// Membresía / Entrenador
export interface TicketMembresia extends TicketHeader {
  concepto: string;
  importe: number | string;
  tipoPago: string;
}
export interface TicketEntrenador extends TicketHeader {
  concepto: string;
  importe: number | string;
  tipoPago: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  // ===== API PÚBLICA =====
  imprimirVenta(data: TicketVenta) {
    const html = this.htmlVenta(data);
    this.abrirYImprimir(html, `ticket-venta-${data.folio ?? ''}.html`);
  }
  verVentaComoHtml(data: TicketVenta) {
    const html = this.htmlVenta(data).replace('onload="window.print();window.close();"', '');
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) { this.descargarHtml(`ticket-venta-${data.folio ?? ''}.html`, html); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  imprimirMembresia(data: TicketMembresia) {
    const html = this.htmlMembresia(data);
    this.abrirYImprimir(html, `ticket-membresia-${data.folio ?? ''}.html`);
  }
  verMembresiaComoHtml(data: TicketMembresia) {
    const html = this.htmlMembresia(data).replace('onload="window.print();window.close();"', '');
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) { this.descargarHtml(`ticket-membresia-${data.folio ?? ''}.html`, html); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  imprimirEntrenador(data: TicketEntrenador) {
    const html = this.htmlEntrenador(data);
    this.abrirYImprimir(html, `ticket-entrenador-${data.folio ?? ''}.html`);
  }
  verEntrenadorComoHtml(data: TicketEntrenador) {
    const html = this.htmlEntrenador(data).replace('onload="window.print();window.close();"', '');
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) { this.descargarHtml(`ticket-entrenador-${data.folio ?? ''}.html`, html); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  // Para descargar el HTML sin abrir ventana
  descargarHtml(nombre: string, html: string) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre || 'ticket.html';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // ===== RENDERERS =====
  private htmlVenta(d: TicketVenta): string {
    const itemsHtml = (d.items ?? []).map(it => {
      const qty = this.toInt(it.cantidad);
      const pu  = this.toNum(it.precioUnit);
      return `
        <div class="mb-1">
          <div>${this.escape(it.nombre)}</div>
          <div class="row">
            <div>x${qty}</div>
            <div class="right">${this.money(qty * pu)}</div>
          </div>
        </div>`;
    }).join('');

    // Subtotal / descuento robustos
    const calculado = (d.items ?? []).reduce((a, i) => a + this.toInt(i.cantidad) * this.toNum(i.precioUnit), 0);
    const subProv   = this.toNum(d.totales?.subtotal);
    const subtotal  = Number.isFinite(subProv) && subProv > 0 ? subProv : calculado;

    const descProv  = this.toNum(d.totales?.descuento);
    const descuento = Number.isFinite(descProv) && descProv > 0 ? descProv : 0;

    const total     = this.toNum(d.totales?.total);

    const lateral = d.leyendaLateral ? `<div class="lateral">${this.escape(d.leyendaLateral)}</div>` : '';
    const brand   = (d.brandTitle ?? 'REVOLUCIÓN ATLÉTICA').toUpperCase();

    // ID grande entre socio y desglose
    const idBlock = this.docId('VENTA', d.folio);

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Venta</title>
${this.baseStyles()}
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  ${lateral}

  <!-- Encabezado fijo -->
  <div class="brand">${this.escape(brand)}</div>

  <!-- Negocio -->
  <div class="title">${this.escape(d.negocio.nombre)}</div>
  ${d.negocio.direccion ? `<div class="muted">${this.escape(d.negocio.direccion)}</div>` : ''}
  ${d.negocio.telefono ? `<div class="muted">TEL: ${this.escape(d.negocio.telefono)}</div>` : ''}

  <div class="hr"></div>
  ${d.folio ? `<div class="muted">FOLIO: <strong>${this.escape(String(d.folio))}</strong></div>` : ''}
  <div class="muted">FECHA: ${this.fechaLarga(d.fecha)}</div>
  ${d.cajero ? `<div class="muted">CAJERO: ${this.escape(d.cajero)}</div>` : ''}
  ${d.socio  ? `<div class="muted">SOCIO: ${this.escape(d.socio)}</div>` : ''}

  ${idBlock ? idBlock + '<div class="hr"></div>' : '<div class="hr"></div>'}

  ${itemsHtml || '<div class="row"><div>—</div><div class="right">$0.00</div></div>'}
  <div class="hr"></div>

  <div class="row"><div>SUBTOTAL</div><div class="right">${this.money(subtotal)}</div></div>
  ${descuento ? `<div class="row"><div>DESCUENTO</div><div class="right">-${this.money(descuento)}</div></div>` : ''}
  <div class="row total"><div><strong>TOTAL</strong></div><div class="right"><strong>${this.money(total)}</strong></div></div>

  ${d.tipoPago ? `<div class="row" style="margin-top:4px;"><div>PAGO</div><div class="right">${this.escape(d.tipoPago)}</div></div>` : ''}

  <div class="hr"></div>
  <div class="center">¡Gracias por su compra!</div>
</div>
</body></html>`;
  }

  private htmlMembresia(d: TicketMembresia): string {
    const idBlock = this.docId('MEMBRESÍA', d.folio);

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Membresía</title>
${this.baseStyles()}
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  <div class="brand">${this.escape('REVOLUCIÓN ATLÉTICA')}</div>
  <div class="title">${this.escape(d.negocio.nombre)}</div>
  ${d.negocio.direccion ? `<div class="muted">${this.escape(d.negocio.direccion)}</div>` : ''}
  ${d.negocio.telefono ? `<div class="muted">TEL: ${this.escape(d.negocio.telefono)}</div>` : ''}

  <div class="hr"></div>
  ${d.folio ? `<div class="muted">FOLIO: <strong>${this.escape(String(d.folio))}</strong></div>` : ''}
  <div class="muted">FECHA: ${this.fechaLarga(d.fecha)}</div>
  ${d.cajero ? `<div class="muted">CAJERO: ${this.escape(d.cajero)}</div>` : ''}
  ${d.socio  ? `<div class="muted">SOCIO: ${this.escape(d.socio)}</div>` : ''}

  ${idBlock ? idBlock + '<div class="hr"></div>' : '<div class="hr"></div>'}

  <div class="mb-1"><strong>${this.escape(d.concepto)}</strong></div>
  <div class="row"><div>IMPORTE</div><div class="right">${this.money(this.toNum(d.importe))}</div></div>
  <div class="row"><div>PAGO</div><div class="right">${this.escape(d.tipoPago)}</div></div>

  <div class="hr"></div>
  <div class="center">¡Gracias!</div>
</div>
</body></html>`;
  }

  private htmlEntrenador(d: TicketEntrenador): string {
    const idBlock = this.docId('ENTRENADOR', d.folio);

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Entrenador</title>
${this.baseStyles()}
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  <div class="brand">${this.escape('REVOLUCIÓN ATLÉTICA')}</div>
  <div class="title">${this.escape(d.negocio.nombre)}</div>

  <div class="hr"></div>
  <div class="muted">FECHA: ${this.fechaLarga(d.fecha)}</div>
  ${d.cajero ? `<div class="muted">ATENDIÓ: ${this.escape(d.cajero)}</div>` : ''}
  ${d.socio  ? `<div class="muted">CLIENTE: ${this.escape(d.socio)}</div>` : ''}

  ${idBlock ? idBlock + '<div class="hr"></div>' : '<div class="hr"></div>'}

  <div class="mb-1"><strong>${this.escape(d.concepto)}</strong></div>
  <div class="row"><div>IMPORTE</div><div class="right">${this.money(this.toNum(d.importe))}</div></div>
  <div class="row"><div>PAGO</div><div class="right">${this.escape(d.tipoPago)}</div></div>

  <div class="hr"></div>
  <div class="center">¡Gracias!</div>
</div>
</body></html>`;
  }

  // ===== Infra =====
  private abrirYImprimir(html: string, nombreArchivo: string) {
    const popup = window.open('', '_blank', 'width=380,height=600,noopener,noreferrer');
    if (!popup) { this.descargarHtml(nombreArchivo, html); return; }
    popup.document.open(); popup.document.write(html); popup.document.close();
  }

  private baseStyles(): string {
    return `
<style>
  html,body { margin:0; padding:0; }
  .ticket   { width: 80mm; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.25; position:relative; }
  .brand    { text-align:center; font-weight:800; margin-bottom: 2px; letter-spacing:.3px; }
  .title    { text-align:center; font-weight:700; margin-bottom: 6px; }
  .center   { text-align:center; }
  .muted    { opacity:.85 }
  .hr       { border-top:1px dashed #000; margin:6px 0; }
  .row      { display:flex; justify-content:space-between; }
  .right    { text-align:right }
  .total    { font-size:12px; }
  .mb-1     { margin-bottom:4px; }

  /* ID grande centrado */
  .doc-id   { text-align:center; font-weight:900; font-size:14px; margin:8px 0 4px; letter-spacing:.4px; }

  /* Leyenda lateral */
  .lateral  { position:absolute; right:-16px; top:10px; writing-mode: vertical-rl; transform: rotate(180deg); font-size:10px; opacity:.8; }

  @page { size: 80mm auto; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>`;
  }

  // ===== Utils =====
  private money(n: number): string {
    const v = this.toNum(n);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(v);
  }
  private fechaLarga(d: Date | string): string {
    const date = (typeof d === 'string') ? new Date(d) : d;
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
  private escape(s: string) {
    return (s ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
  }
  private toNum(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  private toInt(v: unknown): number {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
  }

  /** Renderiza el bloque de ID grande (label + #folio). */
  private docId(label: string, folio?: string | number): string {
    const raw = (folio ?? '').toString().trim();
    if (!raw) return '';
    const hash = /^\d+$/.test(raw) ? `#${raw}` : raw;
    return `<div class="doc-id">${this.escape(label)} <span>${this.escape(hash)}</span></div>`;
  }
}
