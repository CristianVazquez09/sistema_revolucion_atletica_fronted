import { TipoPago } from '../util/enums/tipo-pago';

export type CorteEstado = 'ABIERTO' | 'CERRADO';

/**
 * IMPORTANTE:
 * - En el backend ya normalizaste a "ASESORIA".
 * - Pero dejamos "ACCESORIA" por compatibilidad si te llega algo viejo.
 */
export type OrigenCorte = 'VENTA' | 'MEMBRESIA' | 'ASESORIA' | 'ACCESORIA';

export interface ResumenPagoDTO {
  origen: OrigenCorte;
  tipoPago: TipoPago;
  operaciones: number;
  total: number;
}

export interface ResumenIngresoDTO {
  tipo: 'INSCRIPCION' | 'SUSCRIPCION' | 'VENTA' | 'ASESORIA' | 'ACCESORIA';
  operaciones: number;
  total: number;
}

export interface GimnasioResumen {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string;
}

export interface UsuarioResumen {
  id: number;
  nombreUsuario: string;
  activo: boolean;
}

/** Respuesta base (detalle de corte) */
export interface CorteCajaResponseDTO {
  idCorte: number;
  apertura: string;                 // ISO-8601
  cierre: string | null;            // ISO-8601
  estado: CorteEstado;

  totalGeneral: number;
  totalVentas: number;
  totalMembresias: number;
  totalAccesorias: number;

  desgloses: ResumenPagoDTO[];

  // NUEVOS (pueden venir null)
  fondoCajaInicial?: number | null;
  efectivoEntregado?: number | null;
  efectivoEnCajaConteo?: number | null;
  faltante?: number | null;
  totalSalidasEfectivo?: number | null;
  ingresosEfectivo?: number | null;
  efectivoEsperado?: number | null;

  gimnasio?: GimnasioResumen | null;
  abiertoPor?: UsuarioResumen | null;
  cerradoPor?: UsuarioResumen | null;
}

/** Previsualización en tiempo real (no persiste) */
export interface CorteCajaPreviewDTO {
  idCorte: number;
  apertura: string;
  hasta: string;
  estado: CorteEstado;

  gimnasio?: GimnasioResumen | null;
  abiertoPor?: UsuarioResumen | null;

  fondoCajaInicial: number;
  ingresosEfectivo: number;
  totalSalidasEfectivo: number;
  efectivoEsperado: number;

  totalGeneral: number;
  totalVentas: number;
  totalMembresias: number;
  totalAccesorias: number;
  formasDePago: ResumenPagoDTO[];
  tiposDeIngreso: ResumenIngresoDTO[];
}

/** Requests */
export interface AbrirCorte {
  fondoCajaInicial: number;
}
export interface CerrarCorte {
  hasta: string;
  efectivoEntregado?: number | null;
  efectivoEnCajaConteo?: number | null;
}
export interface RegistrarSalidaEfectivoRequest {
  concepto: string;
  monto: number;
  fecha?: string;
}

/** Salida de efectivo */
export interface SalidaEfectivo {
  idSalida: number;
  fecha: string;
  concepto: string;
  monto: number;
  creadoPor?: number | null;
}

/** Paginación */
export interface PageMeta {
  size: number;
  number: number;
  totalElements: number;
  totalPages: number;
}
export interface PagedResponse<T> {
  content: T[];
  page: PageMeta;
}

/**
 * NUEVO: esto es lo que devuelve ahora tu backend en /actual/desglose
 * (CorteMovimientoViewDTO)
 */
export interface CorteMovimientoViewDTO {
  fecha: string;              // ISO
  origen: OrigenCorte;        // VENTA | MEMBRESIA | ASESORIA (o ACCESORIA legacy)
  folio: string | null;
  socio: string | null;
  concepto: string | null;
  tipoPago: TipoPago;
  monto: number;
  cajero: string | null;
}

/** Respuesta del desglose */
export interface CorteDesgloseDTO {
  corte: CorteCajaResponseDTO;
  movimientos: CorteMovimientoViewDTO[];
  salidas: SalidaEfectivo[];
}

/** Listado (paginado) - coincide con CorteCajaListItemDTO del backend */
export interface CorteCajaListado {
  idCorte: number;
  apertura: string;          // ISO
  cierre: string | null;     // ISO
  estado: CorteEstado;

  totalGeneral: number;
  totalVentas: number;
  totalMembresias: number;
  totalAccesorias: number;

  gimnasio?: GimnasioResumen | null;
  abiertoPor?: UsuarioResumen | null;
  cerradoPor?: UsuarioResumen | null;

  // nuevos en list item
  fondoCajaInicial?: number | null;
  efectivoEsperado?: number | null;
}

