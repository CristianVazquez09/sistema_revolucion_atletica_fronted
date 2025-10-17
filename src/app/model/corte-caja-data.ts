import { TipoPago } from '../util/enums/tipo-pago';

export type OrigenCorte = 'VENTA' | 'MEMBRESIA' | 'ACCESORIA';

export interface ResumenPagoDTO {
  origen: OrigenCorte;
  tipoPago: TipoPago;
  operaciones: number;
  total: number;
}

export type CorteEstado = 'ABIERTO' | 'CERRADO';

export interface CorteCajaResponseDTO {
  idCorte: number;
  apertura: string;          // ISO-8601
  cierre: string | null;     // ISO-8601
  estado: CorteEstado;

  totalGeneral: number;
  totalVentas: number;
  totalMembresias: number;

  /** NUEVO: total acumulado de accesorias */
  totalAccesorias: number;

  desgloses: ResumenPagoDTO[];
}

export interface CerrarCorte {
  hasta: string; // 'YYYY-MM-DDTHH:mm:ss' (local, sin zona)
}

// --- Extensiones para listado/paginación ---
export interface UsuarioResumen {
  id: number;
  nombreUsuario: string;
  activo: boolean;
}

export interface GimnasioResumen {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string;
}

/** Item del listado (incluye gimnasio y usuarios) */
export interface CorteCajaListado extends CorteCajaResponseDTO {
  gimnasio?: GimnasioResumen;
  abiertoPor?: UsuarioResumen;
  cerradoPor?: UsuarioResumen;
}

/** Meta de página (compat con backend) */
export interface PageMeta {
  size: number;
  number: number;        // 0-based
  totalElements: number;
  totalPages: number;
}

/** Respuesta paginada genérica */
export interface PagedResponse<T> {
  content: T[];
  page: PageMeta;
}

