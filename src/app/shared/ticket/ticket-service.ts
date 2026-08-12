// src/app/shared/ticket/ticket-service.ts
// Orquestador delgado: adapta datos de dominio a los tipos Ticket* y delega
// la generación de HTML (ticket-html.ts) y la impresión (ticket-print.ts).
import { Injectable, inject } from '@angular/core';
import {
  CarritoItemCrudo,
  CorteBackend,
  TicketAccesoria,
  TicketCorte,
  TicketEntrenador,
  TicketMembresia,
  TicketPagoDetalle,
  TicketSalidaEfectivo,
  TicketVenta,
  VentaBackend,
  VentaContexto,
  calcularSubtotal,
  fechaFin,
  fechaIni,
  htmlAccesoria,
  htmlCorte,
  htmlEntrenador,
  htmlMembresia,
  htmlSalidaEfectivo,
  htmlVenta,
  mesAnio,
  nombreUsuario,
  normalizarDesglose,
  normalizarItemsDesdeBackend,
  normalizarPagosVentaDesdeBackend,
  pickNum,
  sumarEfectivo,
  sumarPagosPorMetodo,
  sumarPorOrigen,
  resolverTiposIngreso,
  toNum,
} from './ticket-html';
import { TicketPrintService } from './ticket-print';

export * from './ticket-html';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private print = inject(TicketPrintService);

  // =========================================================
  // A) MÉTODOS DE ALTO NIVEL (helpers para UI/flows)
  // =========================================================

  verVentaDesdeBackend(
    venta: VentaBackend,
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[],
  ) {
    const items = normalizarItemsDesdeBackend(venta);
    const subtotal = calcularSubtotal(items);
    const total = Number.isFinite(Number(venta?.total)) ? Number(venta!.total) : subtotal;

    // ✅ si no te mandan pagos explícitos, intenta sacarlos del backend
    const pagosDet = pagos && pagos.length ? pagos : normalizarPagosVentaDesdeBackend(venta);

    const descuento = Number(venta?.descuento) || 0;
    this.verVentaComoHtml({
      negocio: ctx.negocio,
      folio: venta?.folio ?? '',
      // ✅ ya NO lo imprimimos; si quieres conservarlo para lógica externa, déjalo en otro lado
      // idVenta: venta?.idVenta ?? '',
      fecha: venta?.fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, descuento, total },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago, // solo fallback
      pagos: pagosDet, // ✅ lo importante
    });
  }

  imprimirVentaDesdeBackend(
    venta: VentaBackend,
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[],
  ) {
    const items = normalizarItemsDesdeBackend(venta);
    const subtotal = calcularSubtotal(items);
    const total = Number.isFinite(Number(venta?.total)) ? Number(venta!.total) : subtotal;

    // ✅ si no te mandan pagos explícitos, intenta sacarlos del backend
    const pagosDet = pagos && pagos.length ? pagos : normalizarPagosVentaDesdeBackend(venta);

    const descuento = Number(venta?.descuento) || 0;
    this.imprimirVenta({
      negocio: ctx.negocio,
      folio: venta?.folio ?? '',
      // idVenta: venta?.idVenta ?? '',
      fecha: venta?.fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, descuento, total },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago, // solo fallback
      pagos: pagosDet, // ✅ lo importante
    });
  }

  verVentaDesdeCarrito(
    carrito: CarritoItemCrudo[],
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[],
    folio?: string | number,
    fecha?: Date | string,
    idVenta?: string | number,
    descuento?: number,
  ) {
    void idVenta; // compat, ya no se imprime
    const items = carrito.map((it) => ({
      nombre: it.nombre,
      cantidad: it.cantidad,
      precioUnit: it.precioUnit,
    }));
    const subtotal = calcularSubtotal(items);
    const desc = descuento || 0;
    const total = Math.max(0, subtotal - desc);

    this.verVentaComoHtml({
      negocio: ctx.negocio,
      folio: folio ?? '',
      fecha: fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, descuento: desc, total },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago,
      pagos,
    });
  }

  imprimirVentaDesdeCarrito(
    carrito: CarritoItemCrudo[],
    ctx: VentaContexto,
    tipoPago?: string,
    pagos?: TicketPagoDetalle[],
    folio?: string | number,
    fecha?: Date | string,
    idVenta?: string | number,
    descuento?: number,
  ) {
    void idVenta; // compat, ya no se imprime
    const items = carrito.map((it) => ({
      nombre: it.nombre,
      cantidad: it.cantidad,
      precioUnit: it.precioUnit,
    }));
    const subtotal = calcularSubtotal(items);
    const desc = descuento || 0;
    const total = Math.max(0, subtotal - desc);

    this.imprimirVenta({
      negocio: ctx.negocio,
      folio: folio ?? '',
      fecha: fecha ?? new Date(),
      cajero: ctx.cajero,
      socio: ctx.socio,
      items,
      totales: { subtotal, descuento: desc, total },
      leyendaLateral: ctx.leyendaLateral ?? ctx.negocio.nombre,
      brandTitle: ctx.brandTitle,
      tipoPago,
      pagos,
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
    tipoPago?: string; // compat si no mandas pagos
    pagos?: TicketPagoDetalle[]; // desglose real
    referencia?: string | number;
    entrenadorNombre?: string; // entrenador RA
  }) {
    const base = (Number(p.precioPaquete) || 0) + (Number(p.costoInscripcion) || 0);
    const desc = Number(p.descuento) || 0;
    const total = Math.max(0, base - desc);

    const concepto = p.paqueteNombre ? `Membresía ${p.paqueteNombre}` : 'Membresía';

    // fallback a tipoPago si no hay pagos[]
    const pagosDet: TicketPagoDetalle[] | undefined =
      p.pagos && p.pagos.length > 0
        ? p.pagos
        : p.tipoPago
          ? [{ metodo: p.tipoPago, monto: total }]
          : undefined;

    this.verMembresiaComoHtml({
      negocio: p.ctx.negocio,
      folio: p.folio,
      fecha: p.fecha ?? new Date(),
      cajero: p.ctx.cajero,
      socio: p.socioNombre,
      concepto,
      periodo: mesAnio(p.fecha ?? new Date()),
      importe: base,
      descuento: desc,
      total,
      totalAPagar: total,
      pagos: pagosDet,
      tipoPago: p.tipoPago,
      referencia: p.referencia,
      estado: 'PAGADO',
      entrenador: p.entrenadorNombre,
    });
  }

  imprimirMembresiaDesdeContexto(p: {
    ctx: VentaContexto;
    folio: string | number;
    fecha?: Date | string;
    socioNombre: string;
    paqueteNombre?: string | null;
    precioPaquete: number;
    descuento: number;
    costoInscripcion: number;
    tipoPago?: string; // compat si no llegan pagos
    pagos?: TicketPagoDetalle[]; // desglose real (opcional)
    referencia?: string | number; // opcional
    entrenadorNombre?: string; // entrenador RA
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
      periodo: mesAnio(p.fecha ?? new Date()),
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
      entrenador: p.entrenadorNombre,
    };

    const html = htmlMembresia(data);
    // imprime 2 copias
    this.print.abrirYImprimir(html, `ticket-membresia-${p.folio ?? ''}.html`);
    this.print.abrirYImprimir(html, `ticket-membresia-${p.folio ?? ''}.html`);
  }

  imprimirCorteDesdeBackend(
    corte: CorteBackend,
    ctx: { negocio: VentaContexto['negocio']; cajero?: string; brandTitle?: string },
  ) {
    const { data, brand, desde, hasta, extra } = this.armarDatosCorte(corte, ctx);
    const html = htmlCorte(data, brand, desde, hasta, extra);
    this.print.abrirYImprimir(html, `ticket-corte-${data.folio ?? ''}.html`);
  }

  verCorteComoHtml(
    corte: CorteBackend,
    ctx: { negocio: VentaContexto['negocio']; cajero?: string; brandTitle?: string },
  ) {
    const { data, brand, desde, hasta, extra } = this.armarDatosCorte(corte, ctx);
    const html = htmlCorte(data, brand, desde, hasta, extra);
    // comportamiento preexistente: preview de corte no marca data-debug
    this.print.verComoHtml(html, `ticket-corte-${data.folio ?? ''}.html`, false);
  }

  imprimirSalidaEfectivo(d: TicketSalidaEfectivo, brandTitle = 'REVOLUCIÓN ATLÉTICA FITNESS') {
    const html = htmlSalidaEfectivo(d, brandTitle);
    this.print.abrirYImprimir(html, `ticket-retiro-${d.folio ?? ''}.html`);
    this.print.abrirYImprimir(html, `ticket-retiro-${d.folio ?? ''}.html`);
  }

  verSalidaEfectivoComoHtml(d: TicketSalidaEfectivo, brandTitle = 'REVOLUCIÓN ATLÉTICA FITNESS') {
    this.print.verComoHtml(
      htmlSalidaEfectivo(d, brandTitle),
      `ticket-retiro-${d.folio ?? ''}.html`,
    );
  }

  // =========================================================
  // B) API PÚBLICA BASE (render/imprimir directos)
  // =========================================================

  imprimirVenta(d: TicketVenta) {
    const html = htmlVenta(d);
    this.print.abrirYImprimir(html, `ticket-venta-${d.folio ?? ''}.html`);
    this.print.abrirYImprimir(html, `ticket-venta-${d.folio ?? ''}.html`);
  }

  verVentaComoHtml(d: TicketVenta) {
    this.print.verComoHtml(htmlVenta(d), `ticket-venta-${d.folio ?? ''}.html`);
  }

  imprimirMembresia(d: TicketMembresia) {
    const html = htmlMembresia(d);
    this.print.abrirYImprimir(html, `ticket-membresia-${d.folio ?? ''}.html`);
    this.print.abrirYImprimir(html, `ticket-membresia-${d.folio ?? ''}.html`);
  }

  verMembresiaComoHtml(d: TicketMembresia) {
    this.print.verComoHtml(htmlMembresia(d), `ticket-membresia-${d.folio ?? ''}.html`);
  }

  imprimirEntrenador(d: TicketEntrenador) {
    this.print.abrirYImprimir(htmlEntrenador(d), `ticket-entrenador-${d.folio ?? ''}.html`);
  }

  verEntrenadorComoHtml(d: TicketEntrenador) {
    this.print.verComoHtml(htmlEntrenador(d), `ticket-entrenador-${d.folio ?? ''}.html`);
  }

  imprimirAccesoria(d: TicketAccesoria) {
    const html = htmlAccesoria(d);
    this.print.abrirYImprimir(html, `ticket-accesoria-${d.folio ?? ''}.html`);
    this.print.abrirYImprimir(html, `ticket-accesoria-${d.folio ?? ''}.html`);
  }

  verAccesoriaComoHtml(d: TicketAccesoria) {
    this.print.verComoHtml(htmlAccesoria(d), `ticket-accesoria-${d.folio ?? ''}.html`);
  }

  // =========================================================
  // C) Helper interno: arma los datos de TicketCorte (compartido por
  //    imprimirCorteDesdeBackend / verCorteComoHtml, comportamiento idéntico)
  // =========================================================

  private armarDatosCorte(
    corte: CorteBackend,
    ctx: { negocio: VentaContexto['negocio']; cajero?: string; brandTitle?: string },
  ): {
    data: TicketCorte;
    brand: string;
    desde?: Date | string;
    hasta?: Date | string;
    extra: {
      fondo: number;
      ingEfec: number;
      salidas: number;
      esperado: number;
      entregado: number;
      conteo: number;
      faltante: number;
      tiposIngreso: Array<{ label: string; total: number }>;
      desgloseOrigenPago: Array<{
        origen: string;
        tipoPago: string;
        operaciones: number;
        total: number;
      }>;
    };
  } {
    const desgl = Array.isArray(corte?.desgloses) ? corte!.desgloses! : [];

    // Formas de pago (sumado por método)
    const pagos = sumarPagosPorMetodo(desgl as any);

    // Totales por origen
    const ventas = pickNum(toNum(corte?.totalVentas), sumarPorOrigen('VENTA', desgl as any));
    const mems = pickNum(toNum(corte?.totalMembresias), sumarPorOrigen('MEMBRESIA', desgl as any));
    const accs = pickNum(toNum(corte?.totalAccesorias), sumarPorOrigen('ACCESORIA', desgl as any));
    const general = pickNum(toNum(corte?.totalGeneral), ventas + mems + accs);

    // Efectivo en el periodo
    const fondo = toNum(corte?.fondoCajaInicial);
    const ingEfec = pickNum(toNum(corte?.ingresosEfectivo), sumarEfectivo(desgl as any));
    const salidas = toNum(corte?.totalSalidasEfectivo);
    const esperado = pickNum(toNum(corte?.efectivoEsperado), fondo + ingEfec - salidas);
    const entregado = toNum(corte?.efectivoEntregado);
    const conteo = toNum(corte?.efectivoEnCajaConteo);
    const faltante = pickNum(toNum(corte?.faltante), esperado - (entregado + conteo));

    const tiposIngreso = resolverTiposIngreso(corte, { ventas, mems, accs });

    const data: TicketCorte = {
      negocio: ctx.negocio,
      folio: corte?.idCorte ?? '',
      idCorte: corte?.idCorte ?? '',
      fecha: fechaFin(corte),
      cajero: ctx.cajero || nombreUsuario(corte.cerradoPor) || nombreUsuario(corte.usuarioCierre),
      totales: { ventas, membresias: mems, accesorias: accs, general },
      pagos,
    };

    return {
      data,
      brand: ctx.brandTitle ?? 'REVOLUCIÓN ATLÉTICA',
      desde: fechaIni(corte),
      hasta: fechaFin(corte),
      extra: {
        fondo,
        ingEfec,
        salidas,
        esperado,
        entregado,
        conteo,
        faltante,
        tiposIngreso,
        desgloseOrigenPago: normalizarDesglose(corte?.desgloses || []),
      },
    };
  }
}
