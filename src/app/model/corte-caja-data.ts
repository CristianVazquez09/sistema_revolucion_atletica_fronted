import { TipoPago } from '../util/enums/tipo-pago';

export type OrigenCorte = 'VENTA' | 'MEMBRESIA';

export interface ResumenPagoDTO {
  origen: OrigenCorte;
  tipoPago: TipoPago;
  operaciones: number;
  total: number;
}



export type CorteEstado = 'ABIERTO' | 'CERRADO';

export interface CorteCajaResponseDTO {
  idCorte: number;
  apertura: string;         
  cierre: string | null;    
  estado: CorteEstado;
  totalGeneral: number;     
  totalVentas: number;
  totalMembresias: number;
  desgloses: ResumenPagoDTO[];
}

export interface CerrarCorte {
  hasta: string;
}

