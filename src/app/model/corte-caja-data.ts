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
