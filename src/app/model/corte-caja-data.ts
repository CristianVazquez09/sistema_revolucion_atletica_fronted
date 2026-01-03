import { TipoPago } from '../util/enums/tipo-pago';

export type OrigenCorte = 'VENTA' | 'MEMBRESIA' | 'ACCESORIA';
export type CorteEstado = 'ABIERTO' | 'CERRADO';

export interface ResumenPagoDTO {
  origen: OrigenCorte;
  tipoPago: TipoPago;
  operaciones: number;
  total: number;
}

export interface ResumenIngresoDTO {
  tipo: 'INSCRIPCION' | 'SUSCRIPCION' | 'VENTA' | 'ACCESORIA';
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

  // NUEVOS (pueden venir null en abiertos/consultas viejas)
  fondoCajaInicial?: number | null;
  efectivoEntregado?: number | null;
  efectivoEnCajaConteo?: number | null;
  faltante?: number | null;
  totalSalidasEfectivo?: number | null;
  ingresosEfectivo?: number | null;
  efectivoEsperado?: number | null;

  // metadata opcional
  gimnasio?: GimnasioResumen | null;
  abiertoPor?: UsuarioResumen | null;
  cerradoPor?: UsuarioResumen | null;
}

/** Previsualización en tiempo real (no persiste) */
export interface CorteCajaPreviewDTO {
  idCorte: number;
  apertura: string;
  hasta: string;                     // instante de corte de la preview
  estado: CorteEstado;

  gimnasio?: GimnasioResumen | null;
  abiertoPor?: UsuarioResumen | null;

  // Bloques ticket live
  fondoCajaInicial: number;
  ingresosEfectivo: number;
  totalSalidasEfectivo: number;
  efectivoEsperado: number;

  // Totales y desglose
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
  hasta: string;                     // 'YYYY-MM-DDTHH:mm:ss'
  efectivoEntregado?: number | null;
  efectivoEnCajaConteo?: number | null;
}
export interface RegistrarSalidaEfectivoRequest {
  concepto: string;
  monto: number;
  fecha?: string;                    // opcional
}

/** Salida de efectivo */
export interface SalidaEfectivo {
  idSalida: number;
  fecha: string;
  concepto: string;
  monto: number;
  creadoPor?: number | null;
}

/** Listado (paginado) */
export interface CorteCajaListado extends CorteCajaResponseDTO {}

export interface PageMeta {
  size: number;
  number: number;        // 0-based
  totalElements: number;
  totalPages: number;
}
export interface PagedResponse<T> {
  content: T[];
  page: PageMeta;
}
