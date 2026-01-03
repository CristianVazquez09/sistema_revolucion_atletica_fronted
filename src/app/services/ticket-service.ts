// src/app/services/ticket-service.ts
import { Injectable } from '@angular/core';

// =========================
// Tipos / Interfaces
// =========================
export type TicketTipo = 'VENTA' | 'MEMBRESIA' | 'ENTRENADOR' | 'ACCESORIA';

// Acepta { metodo, monto } o { tipoPago, monto }
export interface TicketPagoDetalle { metodo?: string; tipoPago?: string; monto: number; }

export interface TicketHeader {
  negocio: { nombre: string; direccion?: string; telefono?: string };
  folio?: string | number;       // -> número grande centrado
  fecha: Date | string;
  cajero?: string;
  socio?: string;
}

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

export interface TicketVenta extends TicketHeader {
  // ✅ Se mantiene por compatibilidad (si en otro lado lo usas), PERO ya NO se imprime en el ticket.
  idVenta?: string | number;

  items: TicketItem[];
  totales: TicketTotales;
  leyendaLateral?: string;       // leyenda vertical (opcional)
  brandTitle?: string;           // encabezado (por defecto “REVOLUCIÓN ATLÉTICA”)
  tipoPago?: string;             // compat: un solo método
  pagos?: TicketPagoDetalle[];   // desglose: varios métodos
}

export interface TicketMembresia extends TicketHeader {
  concepto: string;              // p.ej. "Membresía MENSUAL"
  periodo?: string;              // p.ej. "Noviembre 2025"
  importe: number | string;      // precio base + inscripción
  descuento?: number | string;
  total?: number | string;       // total tras descuento
  abonado?: number | string;     // si manejas anticipos
  totalAPagar?: number | string; // total - abonado
  pagos?: TicketPagoDetalle[];   // desglose real
  tipoPago?: string;             // compat si no mandas 'pagos'
  cambio?: number | string;
  referencia?: string | number;  // REF:
  saldo?: number | string;
  estado?: 'PAGADO' | 'PENDIENTE';
}

export interface TicketEntrenador extends TicketHeader {
  concepto: string;
  importe: number | string;
  tipoPago?: string;             // compat
  pagos?: TicketPagoDetalle[];   // desglose
}

export interface TicketAccesoria extends TicketHeader {
  concepto: string;
  entrenador?: string;
  tiempo?: string;               // p.ej. "MENSUAL", "8 SESIONES", etc.
  importe: number | string;
  descuento?: number | string;
  total?: number | string;
  pagos?: TicketPagoDetalle[];   // desglose
  tipoPago?: string;             // compat si solo envías un método
  referencia?: string | number;  // opc: id de la asesoría
}

export interface TicketSalidaEfectivo extends TicketHeader {
  idCorte?: string | number;
  concepto: string;
  monto: number | string;
}

// ===== Contexto / Backend =====
export interface VentaContexto {
  negocio: TicketHeader['negocio'];
  cajero?: string;
  socio?: string;
  leyendaLateral?: string;
  brandTitle?: string;
}

export interface CarritoItemCrudo {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnit: number;
}

export interface VentaBackend {
  idVenta?: number | string;
  folio?: number | string;
  fecha?: string | Date;
  total?: number;

  pagos?: Array<{
    tipoPago?: string;   // EFECTIVO | TARJETA | TRANSFERENCIA | ...
    metodo?: string;     // compat
    monto?: number;      // ideal
    total?: number;      // compat
  }>;

  detalles?: Array<{
    cantidad?: number;
    subTotal?: number;
    producto?: { nombre?: string; precioVenta?: number };
  }>;
}

// ===== Ticket Corte de Caja =====
export interface TicketCorte extends TicketHeader {
  idCorte?: string | number;
  desde?: Date | string;
  hasta?: Date | string;
  totales: {
    ventas?: number;
    membresias?: number;
    accesorias?: number;
    general?: number;
  };
  pagos?: {
    EFECTIVO?: number;
    TARJETA?: number;
    TRANSFERENCIA?: number;
    OTRO?: number;
  };
}

// ===== Respuesta tolerante de backend para corte
export interface CorteBackend {
  idCorte?: number | string;

  // Compat nombres de fecha
  desde?: string | Date;     // antiguo
  hasta?: string | Date;     // antiguo
  apertura?: string | Date;  // backend actual
  cierre?: string | Date;    // backend actual

  estado?: string;

  // Totales por origen
  totalVentas?: number;
  totalMembresias?: number;
  totalAccesorias?: number;
  totalGeneral?: number;

  // Efectivo y caja
  fondoCajaInicial?: number;
  ingresosEfectivo?: number;
  totalSalidasEfectivo?: number;
  efectivoEsperado?: number;
  efectivoEntregado?: number;
  efectivoEnCajaConteo?: number;
  faltante?: number;

  // Agregados varios
  desgloses?: Array<{
    origen?: 'VENTA' | 'MEMBRESIA' | 'ACCESORIA' | string;
    tipoPago?: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | string;
    metodo?: string;   // por compat
    operaciones?: number;
    total?: number;
  }>;

  tiposDeIngreso?: Array<{ tipo: string; operaciones?: number; total: number }>;

  // Usuarios (compat)
  usuarioApertura?: { nombreUsuario?: string } | string;
  usuarioCierre?: { nombreUsuario?: string } | string;
  abiertoPor?: { nombreUsuario?: string } | string;
  cerradoPor?: { nombreUsuario?: string } | string;

  gimnasio?: { nombre?: string; direccion?: string; telefono?: string };
}

@Injectable({ providedIn: 'root' })
export class TicketService {

  // =========================================================
  // A) MÉTODOS DE ALTO NIVEL (helpers para UI/flows)
  // =========================================================

  verVentaDesdeBackend(
    venta: VentaBackend,
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[]
  ) {
    const items = this.normalizarItemsDesdeBackend(venta);
    const subtotal = this.calcularSubtotal(items);
    const total = Number.isFinite(Number(venta?.total)) ? Number(venta!.total) : subtotal;

    // ✅ si no te mandan pagos explícitos, intenta sacarlos del backend
    const pagosDet = (pagos && pagos.length) ? pagos : this.normalizarPagosVentaDesdeBackend(venta);

    this.verVentaComoHtml({
      negocio: ctx.negocio,
      folio: venta?.folio ?? '',
      // ✅ ya NO lo imprimimos; si quieres conservarlo para lógica externa, déjalo en otro lado
      // idVenta: venta?.idVenta ?? '',
      fecha: venta?.fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, total },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago,         // solo fallback
      pagos: pagosDet,  // ✅ lo importante
    });
  }

  imprimirVentaDesdeBackend(
    venta: VentaBackend,
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[]
  ) {
    const items = this.normalizarItemsDesdeBackend(venta);
    const subtotal = this.calcularSubtotal(items);
    const total = Number.isFinite(Number(venta?.total)) ? Number(venta!.total) : subtotal;

    // ✅ si no te mandan pagos explícitos, intenta sacarlos del backend
    const pagosDet = (pagos && pagos.length) ? pagos : this.normalizarPagosVentaDesdeBackend(venta);

    this.imprimirVenta({
      negocio: ctx.negocio,
      folio: venta?.folio ?? '',
      // idVenta: venta?.idVenta ?? '',
      fecha: venta?.fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, total },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago,         // solo fallback
      pagos: pagosDet,  // ✅ lo importante
    });
  }

  verVentaDesdeCarrito(
    carrito: CarritoItemCrudo[],
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[],
    folio?: string | number,
    fecha?: Date | string,
    idVenta?: string | number
  ) {
    void idVenta; // compat, ya no se imprime
    const items = carrito.map(it => ({ nombre: it.nombre, cantidad: it.cantidad, precioUnit: it.precioUnit }));
    const subtotal = this.calcularSubtotal(items);

    this.verVentaComoHtml({
      negocio: ctx.negocio,
      folio: folio ?? '',
      fecha: fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, total: subtotal },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago,
      pagos
    });
  }

  imprimirVentaDesdeCarrito(
    carrito: CarritoItemCrudo[],
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[],
    folio?: string | number,
    fecha?: Date | string,
    idVenta?: string | number
  ) {
    void idVenta; // compat, ya no se imprime
    const items = carrito.map(it => ({ nombre: it.nombre, cantidad: it.cantidad, precioUnit: it.precioUnit }));
    const subtotal = this.calcularSubtotal(items);

    this.imprimirVenta({
      negocio: ctx.negocio,
      folio: folio ?? '',
      fecha: fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, total: subtotal },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago,
      pagos
    });
  }

  verMembresiaDesdeContexto(p: {
    ctx: VentaContexto;
    folio: string | number;
    fecha?: Date | string;
    socioNombre: string;
    paqueteNombre?: string | null;
    precioPaquete: number;
    descuento: number;
    costoInscripcion: number;
    tipoPago?: string;                   // compat si no mandas pagos
    pagos?: TicketPagoDetalle[];         // desglose real
    referencia?: string | number;
  }) {
    const base = (Number(p.precioPaquete) || 0) + (Number(p.costoInscripcion) || 0);
    const desc = Number(p.descuento) || 0;
    const total = Math.max(0, base - desc);

    const concepto = p.paqueteNombre ? `Membresía ${p.paqueteNombre}` : 'Membresía';

    // fallback a tipoPago si no hay pagos[]
    const pagosDet: TicketPagoDetalle[] | undefined =
      (p.pagos && p.pagos.length > 0)
        ? p.pagos
        : (p.tipoPago ? [{ metodo: p.tipoPago, monto: total }] : undefined);

    this.verMembresiaComoHtml({
      negocio: p.ctx.negocio,
      folio: p.folio,
      fecha: p.fecha ?? new Date(),
      cajero: p.ctx.cajero,
      socio: p.socioNombre,
      concepto,
      periodo: this.mesAnio(p.fecha ?? new Date()),
      importe: base,
      descuento: desc,
      total,
      totalAPagar: total,
      pagos: pagosDet,
      tipoPago: p.tipoPago,
      referencia: p.referencia,
      estado: 'PAGADO',
    });
  }

  imprimirMembresiaDesdeContexto(p: {
    ctx: VentaContexto; folio: string | number; fecha?: Date | string;
    socioNombre: string; paqueteNombre?: string | null;
    precioPaquete: number; descuento: number; costoInscripcion: number;
    tipoPago?: string;                   // compat si no llegan pagos
    pagos?: TicketPagoDetalle[];         // desglose real (opcional)
    referencia?: string | number;        // opcional
  }) {
    const base = (Number(p.precioPaquete) || 0) + (Number(p.costoInscripcion) || 0);
    const desc = Number(p.descuento) || 0;
    const total = Math.max(0, base - desc);

    const data: TicketMembresia = {
      negocio: p.ctx.negocio,
      folio: p.folio,
      fecha: p.fecha ?? new Date(),
      cajero: p.ctx.cajero,
      socio: p.socioNombre,
      concepto: `Membresía ${p.paqueteNombre ?? ''}`.trim(),
      periodo: this.mesAnio(p.fecha ?? new Date()),
      importe: base,
      descuento: desc,
      total,
      totalAPagar: total,
      pagos: p.pagos,
      tipoPago: p.tipoPago,
      cambio: undefined,
      referencia: p.referencia,
      saldo: 0,
      estado: 'PAGADO',
    };

    const html = this.htmlMembresia(data);
    // imprime 2 copias
    this.abrirYImprimir(html, `ticket-membresia-${p.folio ?? ''}.html`);
    this.abrirYImprimir(html, `ticket-membresia-${p.folio ?? ''}.html`);
  }

  imprimirCorteDesdeBackend(
    corte: CorteBackend,
    ctx: { negocio: TicketHeader['negocio']; cajero?: string; brandTitle?: string }
  ) {
    const desgl = Array.isArray(corte?.desgloses) ? corte!.desgloses! : [];

    // Formas de pago (sumado por método)
    const pagos = this.sumarPagosPorMetodo(desgl as any);

    // Totales por origen
    const ventas   = this.pickNum(this.toNum(corte?.totalVentas),     this.sumarPorOrigen('VENTA',     desgl as any));
    const mems     = this.pickNum(this.toNum(corte?.totalMembresias), this.sumarPorOrigen('MEMBRESIA', desgl as any));
    const accs     = this.pickNum(this.toNum(corte?.totalAccesorias), this.sumarPorOrigen('ACCESORIA', desgl as any));
    const general  = this.pickNum(this.toNum(corte?.totalGeneral),    ventas + mems + accs);

    // Efectivo en el periodo
    const fondo      = this.toNum(corte?.fondoCajaInicial);
    const ingEfec    = this.pickNum(this.toNum(corte?.ingresosEfectivo), this.sumarEfectivo(desgl as any));
    const salidas    = this.toNum(corte?.totalSalidasEfectivo);
    const esperado   = this.pickNum(this.toNum(corte?.efectivoEsperado), fondo + ingEfec - salidas);
    const entregado  = this.toNum(corte?.efectivoEntregado);
    const conteo     = this.toNum(corte?.efectivoEnCajaConteo);
    const faltante   = this.pickNum(this.toNum(corte?.faltante), esperado - (entregado + conteo));

    const tiposIngreso = this.resolverTiposIngreso(corte, { ventas, mems, accs });

    const data: TicketCorte = {
      negocio: ctx.negocio,
      folio: corte?.idCorte ?? '',
      idCorte: corte?.idCorte ?? '',
      fecha: this.fechaFin(corte),
      cajero: ctx.cajero || this.nombreUsuario(corte.cerradoPor) || this.nombreUsuario(corte.usuarioCierre),
      totales: { ventas, membresias: mems, accesorias: accs, general },
      pagos
    };

    const html = this.htmlCorte(
      data,
      ctx.brandTitle ?? 'REVOLUCIÓN ATLÉTICA',
      this.fechaIni(corte),
      this.fechaFin(corte),
      {
        fondo, ingEfec, salidas, esperado, entregado, conteo, faltante,
        tiposIngreso,
        desgloseOrigenPago: this.normalizarDesglose(corte?.desgloses || [])
      }
    );
    this.abrirYImprimir(html, `ticket-corte-${data.folio ?? ''}.html`);
  }

  verCorteComoHtml(
    corte: CorteBackend,
    ctx: { negocio: TicketHeader['negocio']; cajero?: string; brandTitle?: string }
  ) {
    const desgl = Array.isArray(corte?.desgloses) ? corte!.desgloses! : [];

    const pagos = this.sumarPagosPorMetodo(desgl as any);
    const ventas   = this.pickNum(this.toNum(corte?.totalVentas),     this.sumarPorOrigen('VENTA',     desgl as any));
    const mems     = this.pickNum(this.toNum(corte?.totalMembresias), this.sumarPorOrigen('MEMBRESIA', desgl as any));
    const accs     = this.pickNum(this.toNum(corte?.totalAccesorias), this.sumarPorOrigen('ACCESORIA', desgl as any));
    const general  = this.pickNum(this.toNum(corte?.totalGeneral),    ventas + mems + accs);

    const fondo      = this.toNum(corte?.fondoCajaInicial);
    const ingEfec    = this.pickNum(this.toNum(corte?.ingresosEfectivo), this.sumarEfectivo(desgl as any));
    const salidas    = this.toNum(corte?.totalSalidasEfectivo);
    const esperado   = this.pickNum(this.toNum(corte?.efectivoEsperado), fondo + ingEfec - salidas);
    const entregado  = this.toNum(corte?.efectivoEntregado);
    const conteo     = this.toNum(corte?.efectivoEnCajaConteo);
    const faltante   = this.pickNum(this.toNum(corte?.faltante), esperado - (entregado + conteo));

    const tiposIngreso = this.resolverTiposIngreso(corte, { ventas, mems, accs });

    const data: TicketCorte = {
      negocio: ctx.negocio,
      folio: corte?.idCorte ?? '',
      idCorte: corte?.idCorte ?? '',
      fecha: this.fechaFin(corte),
      cajero: ctx.cajero || this.nombreUsuario(corte.cerradoPor) || this.nombreUsuario(corte.usuarioCierre),
      totales: { ventas, membresias: mems, accesorias: accs, general },
      pagos
    };

    const html = this
      .htmlCorte(
        data,
        ctx.brandTitle ?? 'REVOLUCIÓN ATLÉTICA',
        this.fechaIni(corte),
        this.fechaFin(corte),
        {
          fondo, ingEfec, salidas, esperado, entregado, conteo, faltante,
          tiposIngreso,
          desgloseOrigenPago: this.normalizarDesglose(corte?.desgloses || [])
        }
      )
      .replace('onload="window.print();window.close();"', '');

    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) { this.descargarHtml(`ticket-corte-${data.folio ?? ''}.html`, html); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  imprimirSalidaEfectivo(d: TicketSalidaEfectivo, brandTitle = 'REVOLUCIÓN ATLÉTICA FITNESS') {
    const html = this.htmlSalidaEfectivo(d, brandTitle);
    this.abrirYImprimir(html, `ticket-retiro-${d.folio ?? ''}.html`);
    this.abrirYImprimir(html, `ticket-retiro-${d.folio ?? ''}.html`);
  }

  verSalidaEfectivoComoHtml(d: TicketSalidaEfectivo, brandTitle = 'REVOLUCIÓN ATLÉTICA FITNESS') {
    const html = this.htmlSalidaEfectivo(d, brandTitle).replace('onload="window.print();window.close();"', '');
    this.verComoHtml(html, `ticket-retiro-${d.folio ?? ''}.html`);
  }

  // =========================================================
  // B) API PÚBLICA BASE (render/imprimir directos)
  // =========================================================

  imprimirVenta(d: TicketVenta) {
    const html = this.htmlVenta(d);
    this.abrirYImprimir(html, `ticket-venta-${d.folio ?? ''}.html`);
    this.abrirYImprimir(html, `ticket-venta-${d.folio ?? ''}.html`);
  }

  verVentaComoHtml(d: TicketVenta) {
    this.verComoHtml(this.htmlVenta(d), `ticket-venta-${d.folio ?? ''}.html`);
  }

  imprimirMembresia(d: TicketMembresia) {
    const html = this.htmlMembresia(d);
    this.abrirYImprimir(html, `ticket-membresia-${d.folio ?? ''}.html`);
    this.abrirYImprimir(html, `ticket-membresia-${d.folio ?? ''}.html`);
  }

  verMembresiaComoHtml(d: TicketMembresia) {
    this.verComoHtml(this.htmlMembresia(d), `ticket-membresia-${d.folio ?? ''}.html`);
  }

  imprimirEntrenador(d: TicketEntrenador) {
    this.abrirYImprimir(this.htmlEntrenador(d), `ticket-entrenador-${d.folio ?? ''}.html`);
  }

  verEntrenadorComoHtml(d: TicketEntrenador) {
    this.verComoHtml(this.htmlEntrenador(d), `ticket-entrenador-${d.folio ?? ''}.html`);
  }

  imprimirAccesoria(d: TicketAccesoria) {
    const html = this.htmlAccesoria(d);
    this.abrirYImprimir(html, `ticket-accesoria-${d.folio ?? ''}.html`);
    this.abrirYImprimir(html, `ticket-accesoria-${d.folio ?? ''}.html`);
  }

  verAccesoriaComoHtml(d: TicketAccesoria) {
    this.verComoHtml(this.htmlAccesoria(d), `ticket-accesoria-${d.folio ?? ''}.html`);
  }

  // =========================================================
  // C) RENDERERS HTML
  // =========================================================

  private htmlVenta(d: TicketVenta): string {
    const brand = d.brandTitle ?? 'REVOLUCIÓN ATLÉTICA';
    const lateral = d.leyendaLateral ? `<div class="lateral">${this.escape(String(d.leyendaLateral))}</div>` : '';

    const calc = (d.items ?? []).reduce((a, i) => a + this.toInt(i.cantidad) * this.toNum(i.precioUnit), 0);
    const subtotal  = (Number.isFinite(this.toNum(d.totales?.subtotal)) && this.toNum(d.totales?.subtotal) > 0)
      ? this.toNum(d.totales?.subtotal) : calc;
    const descuento = Number.isFinite(this.toNum(d.totales?.descuento)) ? this.toNum(d.totales?.descuento) : 0;
    const total     = this.toNum(d.totales?.total);

    const folioGrande = this.docId('FOLIO', d.folio);

    const itemsRows = (d.items ?? []).map(it => {
      const qty = this.toInt(it.cantidad);
      const pu  = this.toNum(it.precioUnit);
      const amt = qty * pu;
      return `
        <div class="tbl-line">
          <div class="tbl-qty">x${qty}</div>
          <div class="tbl-desc">${this.escape(String(it.nombre))}</div>
          <div class="tbl-amt">${this.money(amt)}</div>
        </div>`;
    }).join('');

    const itemsBlock = itemsRows ? `
      <div class="sec">Detalle</div>
      <div class="tbl">
        <div class="tbl-head">
          <div>Can</div><div>Descripción</div><div>Importe</div>
        </div>
        ${itemsRows}
      </div>
    ` : `
      <div class="sec">Detalle</div>
      <div class="tbl">
        <div class="tbl-head">
          <div>Can</div><div>Descripción</div><div>Importe</div>
        </div>
        <div class="tbl-line">
          <div class="tbl-qty">—</div>
          <div class="tbl-desc">Sin artículos</div>
          <div class="tbl-amt">${this.money(0)}</div>
        </div>
      </div>
    `;

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Venta</title>
${this.baseStyles()}
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  ${lateral}

  <div class="brand">${this.up(brand)}</div>
  <div class="bizline">${this.up(d.negocio.nombre)}</div>
  ${ d.negocio.direccion ? `<div class="bizline">${this.up(d.negocio.direccion)}</div>` : '' }
  ${ d.negocio.telefono  ? `<div class="bizline">TEL: ${this.up(d.negocio.telefono)}</div>` : '' }

  <div class="hr"></div>

  <div class="meta">
    <div class="mrow"><div class="k">FECHA:</div><div class="v">${this.fechaConSegundos(d.fecha)}</div></div>
    ${ d.cajero ? `<div class="mrow"><div class="k">CAJERO:</div><div class="v">${this.escape(String(d.cajero))}</div></div>` : '' }
    ${ d.socio  ? `<div class="mrow"><div class="k">SOCIO:</div><div class="v">${this.escape(String(d.socio))}</div></div>` : '' }
  </div>

  ${folioGrande}

  ${itemsBlock}

  <div class="hr"></div>

  <div class="totals">
    <div class="r"><div class="k">SUBTOTAL</div><div class="v">${this.money(subtotal)}</div></div>
    ${ descuento ? `<div class="r"><div class="k">DESCUENTO</div><div class="v">-${this.money(descuento)}</div></div>` : '' }
    <div class="r total"><div class="k">TOTAL</div><div class="v">${this.money(total)}</div></div>
  </div>

  ${ this.renderBloquePagos(d.tipoPago, d.pagos, total, 'PAGOS') }

  <div class="footer">¡Gracias por su compra!</div>
  <div class="footer">ESTE NO ES UN COMPROBANTE FISCAL</div>
</div>
</body></html>`;
  }

  private htmlMembresia(d: TicketMembresia): string {
    const folioGrande = this.docId('FOLIO', d.folio);

    const estado = (d.estado ?? 'PAGADO').toUpperCase();
    const periodo = d.periodo ?? this.mesAnio(d.fecha);
    const totalParaPago = this.toNum(d.total ?? d.importe);

    const filaMoney = (lbl: string, val?: number | string, strong = false) => {
      const n = this.toNum(val as any);
      if (!Number.isFinite(n)) return '';
      return `<div class="r ${strong ? 'total' : ''}"><div class="k">${this.escape(lbl)}</div><div class="v">${this.money(n)}</div></div>`;
    };

    const refRow = d.referencia
      ? `<div class="r"><div class="k">REF</div><div class="v">${this.escape(String(d.referencia))}</div></div>`
      : '';

    const cambioRow = this.toNum(d.cambio)
      ? `<div class="r"><div class="k">CAMBIO</div><div class="v">${this.money(this.toNum(d.cambio))}</div></div>`
      : '';

    const saldoRow = this.toNum(d.saldo)
      ? `<div class="r"><div class="k">SALDO</div><div class="v">${this.money(this.toNum(d.saldo))}</div></div>`
      : '';

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Membresía</title>
${this.baseStyles()}
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  <div class="brand">${this.up('REVOLUCIÓN ATLÉTICA FITNESS')}</div>
  <div class="bizline">${this.up(d.negocio.nombre)}</div>
  ${ d.negocio.direccion ? `<div class="bizline">${this.up(d.negocio.direccion)}</div>` : '' }
  ${ d.negocio.telefono  ? `<div class="bizline">TEL: ${this.up(d.negocio.telefono)}</div>` : '' }

  <div class="hr"></div>

  <div class="meta">
    <div class="mrow"><div class="k">FECHA:</div><div class="v">${this.fechaConSegundos(d.fecha)}</div></div>
    ${ d.cajero ? `<div class="mrow"><div class="k">CAJERO:</div><div class="v">${this.escape(String(d.cajero))}</div></div>` : '' }
    ${ d.socio  ? `<div class="mrow"><div class="k">SOCIO:</div><div class="v">${this.escape(String(d.socio))}</div></div>` : '' }
  </div>

  ${folioGrande}

  <div class="sec">Suscripción</div>
  <div class="subsec">${this.escape(String(d.concepto))}</div>
  ${ periodo ? `<div class="note">${this.escape(periodo)}</div>` : '' }

  <div class="hr"></div>

  <div class="totals">
    ${filaMoney('IMPORTE', d.importe)}
    ${ this.toNum(d.descuento) ? filaMoney('DESCUENTO', d.descuento) : '' }
    ${filaMoney('TOTAL', d.total ?? d.importe)}
    ${ this.toNum(d.abonado) ? filaMoney('ABONADO', d.abonado) : '' }
    ${filaMoney('TOTAL A PAGAR', d.totalAPagar ?? d.total ?? d.importe, true)}
  </div>

  ${ this.renderBloquePagos(d.tipoPago, d.pagos, totalParaPago, 'DATOS DEL PAGO') }

  <div class="totals" style="margin-top:4px;">
    ${cambioRow}
    ${refRow}
    ${saldoRow}
  </div>

  <div class="stamp">*** ${this.escape(estado)} ***</div>
  <div class="footer">ESTE NO ES UN COMPROBANTE FISCAL</div>
</div>
</body></html>`;
  }

  private htmlEntrenador(d: TicketEntrenador): string {
    const folioGrande = this.docId('FOLIO', d.folio);
    const total = this.toNum(d.importe);

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Entrenador</title>
${this.baseStyles()}
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  <div class="brand">${this.up('REVOLUCIÓN ATLÉTICA')}</div>
  <div class="bizline">${this.up(d.negocio.nombre)}</div>
  ${ d.negocio.direccion ? `<div class="bizline">${this.up(d.negocio.direccion)}</div>` : '' }
  ${ d.negocio.telefono  ? `<div class="bizline">TEL: ${this.up(d.negocio.telefono)}</div>` : '' }

  <div class="hr"></div>

  <div class="meta">
    <div class="mrow"><div class="k">FECHA:</div><div class="v">${this.fechaConSegundos(d.fecha)}</div></div>
    ${ d.cajero ? `<div class="mrow"><div class="k">ATENDIÓ:</div><div class="v">${this.escape(String(d.cajero))}</div></div>` : '' }
    ${ d.socio  ? `<div class="mrow"><div class="k">CLIENTE:</div><div class="v">${this.escape(String(d.socio))}</div></div>` : '' }
  </div>

  ${folioGrande}

  <div class="sec">Detalle</div>
  <div class="tbl">
    <div class="tbl-line" style="grid-template-columns: 1fr;">
      <div class="tbl-desc" style="white-space:normal; overflow:visible;">${this.escape(String(d.concepto))}</div>
    </div>
  </div>

  <div class="hr"></div>

  <div class="totals">
    <div class="r total"><div class="k">IMPORTE</div><div class="v">${this.money(total)}</div></div>
  </div>

  ${ this.renderBloquePagos(d.tipoPago, d.pagos, total, 'PAGOS') }

  <div class="footer">¡Gracias!</div>
  <div class="footer">ESTE NO ES UN COMPROBANTE FISCAL</div>
</div>
</body></html>`;
  }

  private htmlAccesoria(d: TicketAccesoria): string {
    const folioGrande = this.docId('FOLIO', d.folio);
    const total = this.toNum(d.total ?? d.importe);

    const filaMoney = (lbl: string, val?: number | string, strong = false) => {
      const n = this.toNum(val as any);
      if (!Number.isFinite(n)) return '';
      return `<div class="r ${strong ? 'total' : ''}"><div class="k">${this.escape(lbl)}</div><div class="v">${this.money(n)}</div></div>`;
    };

    const refRow = d.referencia
      ? `<div class="r"><div class="k">REF</div><div class="v">${this.escape(String(d.referencia))}</div></div>`
      : '';

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Asesoría</title>
${this.baseStyles()}
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  <div class="brand">${this.up('REVOLUCIÓN ATLÉTICA FITNESS')}</div>
  <div class="bizline">${this.up(d.negocio.nombre)}</div>
  ${ d.negocio.direccion ? `<div class="bizline">${this.up(d.negocio.direccion)}</div>` : '' }
  ${ d.negocio.telefono  ? `<div class="bizline">TEL: ${this.up(d.negocio.telefono)}</div>` : '' }

  <div class="hr"></div>

  <div class="meta">
    <div class="mrow"><div class="k">FECHA:</div><div class="v">${this.fechaConSegundos(d.fecha)}</div></div>
    ${ d.cajero ? `<div class="mrow"><div class="k">CAJERO:</div><div class="v">${this.escape(String(d.cajero))}</div></div>` : '' }
    ${ d.socio  ? `<div class="mrow"><div class="k">SOCIO:</div><div class="v">${this.escape(String(d.socio))}</div></div>` : '' }
    ${ d.entrenador ? `<div class="mrow"><div class="k">ENTRENADOR:</div><div class="v">${this.escape(String(d.entrenador))}</div></div>` : '' }
    ${ d.tiempo ? `<div class="mrow"><div class="k">TIEMPO:</div><div class="v">${this.escape(String(d.tiempo))}</div></div>` : '' }
  </div>

  ${folioGrande}

  <div class="sec">Detalle</div>
  <div class="tbl">
    <div class="tbl-line" style="grid-template-columns: 1fr;">
      <div class="tbl-desc" style="white-space:normal; overflow:visible;">${this.escape(String(d.concepto))}</div>
    </div>
  </div>

  <div class="hr"></div>

  <div class="totals">
    ${filaMoney('IMPORTE', d.importe)}
    ${ this.toNum(d.descuento) ? filaMoney('DESCUENTO', d.descuento) : '' }
    ${filaMoney('TOTAL', d.total ?? d.importe, true)}
  </div>

  ${ this.renderBloquePagos(d.tipoPago, d.pagos, total, 'PAGOS') }

  <div class="totals" style="margin-top:4px;">
    ${refRow}
  </div>

  <div class="footer">¡Gracias!</div>
  <div class="footer">ESTE NO ES UN COMPROBANTE FISCAL</div>
</div>
</body></html>`;
  }

  private htmlSalidaEfectivo(d: TicketSalidaEfectivo, brandTitle: string): string {
    const folioGrande = this.docId('FOLIO', d.folio);
    const monto = this.toNum(d.monto);
    const concepto = this.escape(String(d.concepto ?? 'Salida de efectivo'));

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Retiro</title>
${this.baseStyles()}
<style>
  .banner{ text-align:center; font-weight:900; margin:4px 0; text-transform:uppercase; letter-spacing:.3px; }
</style>
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  <div class="brand">${this.up(brandTitle)}</div>
  <div class="bizline">${this.up(d.negocio.nombre)}</div>
  ${ d.negocio.direccion ? `<div class="bizline">${this.up(d.negocio.direccion)}</div>` : '' }
  ${ d.negocio.telefono  ? `<div class="bizline">TEL: ${this.up(d.negocio.telefono)}</div>` : '' }

  <div class="banner">::: RETIRO DE EFECTIVO :::</div>

  <div class="hr"></div>

  <div class="meta">
    <div class="mrow"><div class="k">FECHA:</div><div class="v">${this.fechaConSegundos(d.fecha)}</div></div>
    ${ d.cajero ? `<div class="mrow"><div class="k">USUARIO:</div><div class="v">${this.escape(String(d.cajero))}</div></div>` : '' }
    ${ d.idCorte ? `<div class="mrow"><div class="k">CORTE #:</div><div class="v">${this.escape(String(d.idCorte))}</div></div>` : '' }
  </div>

  ${folioGrande}

  <div class="sec">Detalle</div>
  <div class="tbl">
    <div class="tbl-line" style="grid-template-columns: 1fr;">
      <div class="tbl-desc" style="white-space:normal; overflow:visible;">${concepto}</div>
    </div>
  </div>

  <div class="hr"></div>

  <div class="totals">
    <div class="r total"><div class="k">MONTO</div><div class="v">${this.money(monto)}</div></div>
  </div>

  <div class="hr"></div>
  <div class="footer">FIRMA: ____________________</div>
</div>
</body></html>`;
  }

  /**
   * Render de CORTE con secciones estilo “resumen”.
   * Incluye: Tipos de ingresos, Formas de pago (sumario) y
   *          ***Desglose por Origen y Tipo de pago*** (tabla estilo UI).
   */
  private htmlCorte(
    d: TicketCorte,
    brandTitle: string,
    desde?: Date | string,
    hasta?: Date | string,
    extra?: {
      fondo?: number; ingEfec?: number; salidas?: number; esperado?: number;
      entregado?: number; conteo?: number; faltante?: number;
      tiposIngreso?: Array<{ label: string; total: number }>;
      desgloseOrigenPago?: Array<{ origen: string; tipoPago: string; operaciones: number; total: number }>;
    }
  ): string {
    const brand  = this.up(brandTitle);
    const nombre = this.up(d.negocio.nombre);
    const dir    = d.negocio.direccion ? `<div class="bizline">${this.up(d.negocio.direccion)}</div>` : '';
    const tel    = d.negocio.telefono  ? `<div class="bizline">TEL: ${this.up(d.negocio.telefono)}</div>` : '';

    const desdeTxt = desde ? this.fechaConSegundos(desde) : '';
    const hastaTxt = hasta ? this.fechaConSegundos(hasta) : this.fechaConSegundos(new Date());
    const folioGrande = this.docId('CORTE', d.folio);

    const fila = (lbl: string, val?: number) =>
      (this.toNum(val) || val === 0)
        ? `<div class="row"><div>${this.escape(lbl)}</div><div class="amount">${this.money(this.toNum(val))}</div></div>`
        : '';

    const tiposHtml = (extra?.tiposIngreso ?? [])
      .map(t => `<div class="row"><div>${this.escape(t.label)}</div><div class="amount">${this.money(this.toNum(t.total))}</div></div>`)
      .join('');

    // Sumario de formas de pago
    const pagosList = this.pagosObjToList(d.pagos);

    // Detalle por origen y método
    const det = extra?.desgloseOrigenPago ?? [];
    const detalleRows = det.map(r => `
      <div class="grid4">
        <div class="c1">${this.escape(r.origen)}</div>
        <div class="c2">${this.escape(r.tipoPago)}</div>
        <div class="c3">${this.toInt(r.operaciones)}</div>
        <div class="c4">${this.money(this.toNum(r.total))}</div>
      </div>`).join('');

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Ticket Corte</title>
${this.baseStyles()}
<style>
  .sec   { margin:6px 0 4px; padding:3px 0 1px; border-top:1px dotted #000; font-weight:700; text-transform:uppercase; }
  .muted { opacity:.9; }
  .banner{ text-align:center; font-weight:900; margin:4px 0; text-transform:uppercase; }

  /* Tabla 4 columnas: ORIGEN | PAGO | OPS | TOTAL */
  .grid4 {
    display:grid;
    grid-template-columns: 12mm 12mm 6mm 10mm;
    gap:0;
    align-items:center;
    font-size: var(--fs-small);
  }
  .grid4 > .c1,
  .grid4 > .c2 {
    padding-right:0.5mm;
    text-transform:uppercase;
    white-space: nowrap;
    overflow:hidden;
    text-overflow: ellipsis;
  }
  .grid4 > .c3 { text-align:center; }
  .grid4 > .c4 { text-align:right; font-variant-numeric:tabular-nums; }
  .head4 { font-weight:700; border-bottom:1px dotted #000; padding-bottom:1px; margin-bottom:2px; text-transform:uppercase; }
</style>
</head>
<body onload="window.print();window.close();">
<div class="ticket">
  <div class="brand">${brand}</div>
  <div class="bizline">${nombre}</div>
  ${dir}${tel}

  <div class="banner">::: CORTE DE CAJA :::</div>
  <div class="center muted">— resumen —</div>

  ${ d.idCorte ? `<div class="info">CORTE # ${this.escape(String(d.idCorte))}</div>` : '' }
  ${ desdeTxt ? `<div class="info">APERTURA: ${desdeTxt}</div>` : '' }
  <div class="info">FECHA: ${hastaTxt}</div>
  ${ d.cajero ? `<div class="info">CAJERO: ${this.escape(String(d.cajero))}</div>` : '' }

  ${folioGrande}

  ${fila('FONDO DE CAJA', extra?.fondo)}
  ${fila('INGRESOS EN EFECTIVO', extra?.ingEfec)}

  <div class="sec">GASTOS</div>
  ${fila('SALIDAS DE EFECTIVO', extra?.salidas)}

  <div class="sec">EFECTIVO EN CAJA</div>
  ${fila('EFECTIVO EN CAJA', extra?.esperado)}
  ${fila('EFEC. ENTREGADO',  extra?.entregado)}
  ${fila('FALTANTE',         extra?.faltante)}

  <div class="sec">CANTIDADES ENTREGADAS POR EL CAJERO</div>
  ${fila('EFECTIVO', extra?.entregado)}
  ${fila('VOUCHERS', 0)}
  ${fila('CHEQUE', 0)}
  ${fila('FICHAS DE DEP.', 0)}

  <div class="sec">TIPOS DE INGRESOS</div>
  ${ tiposHtml || (
      fila('INSCRIPCIONES', d.totales.membresias ? 0 : 0) +
      fila('SUSCRIPCIONES', d.totales.membresias) +
      fila('VENTAS', d.totales.ventas) +
      fila('ACCESORÍAS', d.totales.accesorias)
    )
  }

  <div class="sec">FORMAS DE PAGO</div>
  ${ this.renderBloquePagos(undefined, pagosList, undefined, undefined) || '<div class="row"><div>—</div><div class="amount">$0.00</div></div>' }

  ${ det.length ? `
    <div class="sec">DESGLOSE POR ORIGEN Y PAGO</div>
    <div class="grid4 head4">
      <div class="c1">ORIGEN</div>
      <div class="c2">PAGO</div>
      <div class="c3">OPS</div>
      <div class="c4">TOTAL</div>
    </div>
    ${detalleRows}
  ` : ''}

  <div class="sp"></div>
  <div class="row total"><div>TOTAL</div><div class="amount">${this.money(this.toNum(d.totales.general))}</div></div>
</div>
</body></html>`;
  }

  // =========================================================
  // D) INFRA (abrir/descargar/preview)
  // =========================================================

  private abrirYImprimir(html: string, nombreArchivo: string) {
    const sanitized = html.replace('onload="window.print();window.close();"', '');
    const electronApi = (window as any)?.electron;
    if (electronApi?.printTicket) {
      const preferred = localStorage.getItem('ra_printer_name') || undefined;
      electronApi.printTicket(sanitized, preferred).catch((err: any) => console.error('[TicketService] print:', err));
      return;
    }
    const win = window.open('', '_blank', 'width=330,height=600,noopener,noreferrer');
    if (!win) { this.descargarHtml(nombreArchivo, sanitized); return; }
    win.document.open(); win.document.write(sanitized); win.document.close();
    const doPrint = () => { try { win.focus(); win.print(); } finally { setTimeout(() => win.close(), 300); } };
    if (win.document.readyState === 'complete') setTimeout(doPrint, 100);
    else win.addEventListener('load', () => setTimeout(doPrint, 100));
  }

  private verComoHtml(html: string, nombre: string) {
    const h = html
      .replace('onload="window.print();window.close();"', '')
      .replace('<body', '<body data-debug="1"');
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) { this.descargarHtml(nombre, h); return; }
    w.document.open(); w.document.write(h); w.document.close();
  }

  private descargarHtml(nombre: string, html: string) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre || 'ticket.html';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // =========================================================
  // E) ESTILOS BASE (57mm, sin márgenes del navegador)
  // =========================================================

  private rollMm(): number {
    const n = Number(localStorage.getItem('ra_roll_mm') || '44'); // contenido estrecho seguro
    return (n >= 42 && n <= 58) ? n : 44;
  }

  private shiftMm(): number {
    const n = Number(localStorage.getItem('ra_shift_mm') || '-1.4'); // desplaza a la IZQ
    return (n >= -3 && n <= 3) ? n : -1.4;
  }

  private baseStyles(mm: number = this.rollMm(), shift: number = this.shiftMm()): string {
    const amountW = mm <= 46 ? 16 : 18; // columna de montos más angosta
    return `
<style>
  html,body { margin:0; padding:0; }

  .ticket { --fs-brand:14px; --fs-head:11px; --fs-base:10.5px; --fs-small:10px; --fs-micro:9.2px; }

  .ticket {
    box-sizing:border-box;
    width:${mm}mm;
    padding:1.6mm;
    margin-left:${shift}mm;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size:var(--fs-base);
    line-height:1.22;
    position:relative;
  }

  .brand    { text-align:center; font-weight:900; font-size: var(--fs-brand); letter-spacing:.4px; }
  .bizline  { text-align:center; text-transform: uppercase; font-size: var(--fs-small); margin-top:1px; }
  .info     { font-size: var(--fs-head); margin-top: 2px; }
  .center   { text-align:center; }
  .sp       { height: 4px; }

  /* Separador */
  .hr { border-top:1px dotted #000; margin:5px 0; opacity:.95; }

  /* Meta compacta */
  .meta { margin-top:4px; font-size: var(--fs-head); }
  .meta .mrow { display:flex; gap:2mm; margin:1px 0; }
  .meta .k { flex:0 0 auto; font-weight:700; text-transform:uppercase; }
  .meta .v { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-transform:uppercase; }

  /* Secciones */
  .sec { margin-top:5px; font-weight:900; text-transform:uppercase; font-size: var(--fs-small); letter-spacing:.2px; }
  .subsec { margin-top:2px; font-weight:700; text-transform:uppercase; font-size: var(--fs-micro); opacity:.92; }

  /* Folio grande */
  .doc-id { text-align:center; font-weight:900; font-size:20px; margin:6px 0 6px; letter-spacing:.8px; }
  .doc-id .lbl { display:block; font-size: var(--fs-micro); letter-spacing:.4px; margin-bottom:1px; opacity:.9; font-weight:700; text-transform:uppercase; }

  /* Tabla de detalle */
  .tbl { margin-top:3px; font-size: var(--fs-small); }
  .tbl-head, .tbl-line {
    display:grid;
    grid-template-columns: 7mm 1fr ${amountW}mm;
    gap:1.2mm;
    align-items:baseline;
  }
  .tbl-head {
    font-weight:900;
    text-transform:uppercase;
    border-bottom:1px dotted #000;
    padding-bottom:2px;
    margin-bottom:2px;
    font-size: var(--fs-micro);
  }
  .tbl-line { padding:1px 0; }
  .tbl-qty { text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tbl-desc { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-transform:uppercase; }
  .tbl-amt { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .note { margin-top:2px; font-size: var(--fs-micro); opacity:.9; text-transform:uppercase; }

  /* Totales */
  .totals { margin-top:2px; font-size: var(--fs-small); }
  .totals .r { display:flex; gap:2mm; margin:1px 0; align-items:baseline; }
  .totals .k { flex:1 1 auto; min-width:0; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .totals .v { flex:0 0 ${amountW}mm; text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .totals .r.total { font-weight:900; font-size:11.6px; margin-top:2px; }

  /* Footer + sello */
  .footer { margin-top:6px; text-align:center; font-size: var(--fs-micro); text-transform:uppercase; opacity:.95; }
  .stamp  { margin-top:4px; text-align:center; font-weight:900; text-transform:uppercase; letter-spacing:.5px; }

  /* Leyenda lateral */
  .lateral{
    position:absolute; right:1.1mm; top:7mm;
    writing-mode:vertical-rl; transform:rotate(180deg);
    font-size:8.8px; opacity:.55; max-height:calc(100% - 10mm);
    letter-spacing:.2px;
  }

  /* ===== Compat (para corte y legacy) ===== */
  .row   { display:flex; align-items:flex-end; margin:1px 0; font-size: var(--fs-small); }
  .row > div:first-child { flex:1 1 auto; min-width:0; padding-right:1mm; word-break:break-word; }
  .amount { flex:0 0 ${amountW}mm; text-align:right; font-variant-numeric:tabular-nums; }
  .total  { font-weight:700; }

  @page { size: 57mm auto; margin:0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>`;
  }

  // =========================================================
  // F) UTILS
  // =========================================================

  private money(n: number): string {
    const v = this.toNum(n);
    const s = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(v);
    return s.replace(/\u00A0|\s/g, '');
  }

  private fechaConSegundos(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
  }

  private escape(s: string) {
    return (s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
  }

  private toNum(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizarPagosVentaDesdeBackend(venta: any): TicketPagoDetalle[] | undefined {
    const arr = Array.isArray(venta?.pagos) ? venta.pagos : [];
    const out = arr
      .map((p: any) => ({
        metodo: String(p?.tipoPago ?? p?.metodo ?? '').trim(),
        monto: this.toNum(p?.monto ?? p?.total),
      }))
      .filter((p: TicketPagoDetalle) => !!p.metodo && this.toNum(p.monto) > 0);

    return out.length ? out : undefined;
  }

  private toInt(v: unknown): number {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
  }

  private pickNum(prefer: number, fallback: number) {
    return Number.isFinite(prefer) && prefer > 0 ? prefer : fallback;
  }

  /** Bloque del número grande (valor + label opcional). */
  private docId(label: string | null | undefined, folio?: string | number): string {
    const raw = (folio ?? '').toString().trim();
    if (!raw) return '';
    const val = /^\d+$/.test(raw) ? `${raw}` : this.escape(raw);
    const lbl = (label ?? '').toString().trim();
    return `<div class="doc-id">${lbl ? `<span class="lbl">${this.escape(lbl)}</span>` : ''}<span>${val}</span></div>`;
  }

  private normalizarItemsDesdeBackend(venta: VentaBackend): TicketItem[] {
    const lista = Array.isArray(venta?.detalles) ? venta!.detalles! : [];
    return lista.map((d: any) => {
      const qty: number    = Number(d?.cantidad ?? 0) || 0;
      const pVenta: number = Number(d?.producto?.precioVenta);
      const subTot: number = Number(d?.subTotal);
      const unit: number   = Number.isFinite(pVenta) ? pVenta : (qty > 0 && Number.isFinite(subTot) ? subTot / qty : 0);
      return { nombre: d?.producto?.nombre ?? '—', cantidad: qty, precioUnit: unit };
    });
  }

  private calcularSubtotal(items: TicketItem[]): number {
    return items.reduce((acc, it) => acc + this.toInt(it.cantidad) * this.toNum(it.precioUnit), 0);
  }

  private up(v: unknown): string {
    return this.escape(String(v ?? '').toUpperCase());
  }

  /** Suma por origen (VENTA/MEMBRESIA/ACCESORIA) desde desgloses. */
  private sumarPorOrigen(origen: string, arr: Array<{ origen?: string; total?: number }>): number {
    if (!Array.isArray(arr)) return 0;
    return arr
      .filter(d => String(d?.origen).toUpperCase() === String(origen).toUpperCase())
      .reduce((a, d) => a + (this.toNum(d?.total) || 0), 0);
  }

  private metodoFromDesglose(d: any): string {
    return (
      d?.tipoPago ??
      d?.metodo ??
      d?.metodoPago ??
      d?.formaPago ??
      d?.tipo_pago ??
      d?.metodo_pago ??
      d?.forma_de_pago ??
      ''
    ).toString();
  }

  /** Suma por método de pago y devuelve objeto {EFECTIVO, TARJETA, TRANSFERENCIA, OTRO}. */
  private sumarPagosPorMetodo(
    arr: Array<{ metodo?: string; tipoPago?: string; total?: number }>
  ): TicketCorte['pagos'] {
    const out: TicketCorte['pagos'] = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0, OTRO: 0 };

    for (const d of (arr || [])) {
      const rawMetodo = this.metodoFromDesglose(d);
      const bucket = this.normalizeMetodoPago(rawMetodo);
      const v = this.toNum(d?.total);
      if (v) out[bucket] = (out[bucket] || 0) + v;
    }
    return out;
  }

  private normalizeMetodoPago(v?: string): 'EFECTIVO'|'TARJETA'|'TRANSFERENCIA'|'OTRO' {
    const s = String(v ?? '').trim().toUpperCase();
    const norm = s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.\s_-]+/g,'');

    const mapEq: Record<string,'EFECTIVO'|'TARJETA'|'TRANSFERENCIA'|'OTRO'> = {
      'EFECTIVO':'EFECTIVO','CASH':'EFECTIVO','CONTADO':'EFECTIVO',
      'TARJETA':'TARJETA','CARD':'TARJETA','CREDITO':'TARJETA','CRÉDITO':'TARJETA',
      'DEBITO':'TARJETA','DÉBITO':'TARJETA','VISA':'TARJETA','MASTERCARD':'TARJETA',
      'TRANSFERENCIA':'TRANSFERENCIA','TRANSFER':'TRANSFERENCIA',
      'SPEI':'TRANSFERENCIA','DEPOSITO':'TRANSFERENCIA','DEPÓSITO':'TRANSFERENCIA',
      'MIXTO':'OTRO','OTRO':'OTRO'
    };
    if (mapEq[s]) return mapEq[s];
    if (mapEq[norm]) return mapEq[norm];

    if (/EFECT/.test(s) || /CASH/.test(s)) return 'EFECTIVO';
    if (/TARJ/.test(s) || /CARD/.test(s) || /CREDIT/.test(norm) || /DEBIT/.test(norm)) return 'TARJETA';
    if (/TRANSF/.test(s) || /SPEI/.test(s) || /DEPOS/.test(norm)) return 'TRANSFERENCIA';
    return 'OTRO';
  }

  private pagosObjToList(p?: TicketCorte['pagos']): TicketPagoDetalle[] {
    const _p = p || {};
    const list: TicketPagoDetalle[] = [];
    const push = (metodo: string, val?: number) => {
      const n = this.toNum(val);
      if (n > 0) list.push({ metodo, monto: n });
    };
    push('EFECTIVO',      (_p as any).EFECTIVO);
    push('TARJETA',       (_p as any).TARJETA);
    push('TRANSFERENCIA', (_p as any).TRANSFERENCIA);
    push('OTRO',          (_p as any).OTRO);
    return list;
  }

  private normalizarDesglose(
    arr: Array<{ origen?: string; tipoPago?: string; metodo?: string; operaciones?: number; total?: number }>
  ) {
    const niceOrigen = (o?: string) => {
      const s = String(o ?? '').toUpperCase();
      if (/MEMB/.test(s)) return 'MEMBRESIA';
      if (/ACCES/.test(s)) return 'ACCESORIA';
      if (/VENTA/.test(s)) return 'VENTA';
      return s || '-';
    };

    return (arr || [])
      .map(d => {
        const metodo = this.metodoFromDesglose(d);
        return {
          origen: niceOrigen(d.origen),
          tipoPago: this.pagoLabelCorto(metodo),
          operaciones: this.toInt(d.operaciones),
          total: this.toNum(d.total),
        };
      })
      .filter(x => x.total > 0 || x.operaciones > 0);
  }

  private pagoLabel(v?: string): string {
    const raw = String(v ?? '').trim();
    return raw.replace(/\s*[:,-].*$/, '').replace(/\s*\$.*$/, '');
  }

  private pagoLabelCorto(v?: string): string {
    const base = this.pagoLabel(v).toUpperCase().trim();

    if (base.startsWith('EFECT')) return 'EFEC';
    if (base.startsWith('TARJ'))  return 'TARJ';
    if (base.includes('TRANS'))   return 'TRASF';
    if (base.includes('SPEI'))    return 'SPEI';
    if (base.includes('DEPOS'))   return 'DEP.';
    if (base.includes('OTRO'))    return 'OTRO';

    return base.slice(0, 6);
  }

  private mesAnio(d?: Date | string): string {
    try {
      const date = d ? (typeof d === 'string' ? new Date(d) : d) : new Date();
      return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
        .format(date)
        .replace(/^\p{Ll}/u, c => c.toUpperCase());
    } catch { return ''; }
  }

  private sumarEfectivo(
    arr: Array<{ tipoPago?: string; metodo?: string; total?: number }>
  ): number {
    return (arr || [])
      .filter(d => this.normalizeMetodoPago(this.metodoFromDesglose(d)) === 'EFECTIVO')
      .reduce((a, d) => a + this.toNum(d?.total), 0);
  }

  private resolverTiposIngreso(corte: CorteBackend, fb?: { ventas: number; mems: number; accs: number }) {
    if (Array.isArray(corte?.tiposDeIngreso) && corte!.tiposDeIngreso!.length) {
      return corte!.tiposDeIngreso!
        .filter(x => this.toNum((x as any).total) > 0)
        .map(x => ({ label: String((x as any).tipo).replace('_',' ').toUpperCase(), total: this.toNum((x as any).total) }));
    }
    return [
      { label: 'VENTAS',        total: this.toNum(fb?.ventas) },
      { label: 'SUSCRIPCIONES', total: this.toNum(fb?.mems) },
      { label: 'ACCESORÍAS',    total: this.toNum(fb?.accs) },
    ].filter(x => x.total > 0);
  }

  private fechaIni(c: CorteBackend) { return c.desde ?? c.apertura; }
  private fechaFin(c: CorteBackend) { return c.hasta ?? c.cierre ?? new Date(); }
  private nombreUsuario(u: any): string {
    return typeof u === 'string' ? u : (u?.nombreUsuario || '');
  }

  /**
   * Bloque de pagos:
   * - Si vienen pagos[] => imprime desglose.
   * - Si no vienen => usa tipoPago + totalFallback.
   * - Si title se manda => agrega sección con hr.
   */
  private renderBloquePagos(
    tipoPago?: string,
    pagos?: TicketPagoDetalle[],
    totalFallback?: number,
    title?: string
  ): string {
    const list = (pagos ?? []).filter(p => this.toNum(p.monto) > 0);

    let rows = '';
    if (list.length) {
      rows = list.map(p => {
        const label = this.pagoLabel(String(p.metodo ?? p.tipoPago ?? '')).toUpperCase();
        return `<div class="r"><div class="k">PAGO ${this.escape(label)}</div><div class="v">${this.money(this.toNum(p.monto))}</div></div>`;
      }).join('');
    } else if (tipoPago) {
      const label = this.pagoLabel(tipoPago).toUpperCase();
      const amount = Number.isFinite(this.toNum(totalFallback))
        ? this.money(this.toNum(totalFallback))
        : '';
      rows = `<div class="r"><div class="k">PAGO ${this.escape(label)}</div><div class="v">${amount}</div></div>`;
    } else {
      return '';
    }

    return `
      <div class="hr"></div>
      ${ title ? `<div class="sec">${this.escape(title)}</div>` : '' }
      <div class="totals">
        ${rows}
      </div>
    `;
  }
}
