import { PagoData } from './membresia-data';

export type MembresiaPatchAction =
  | { op: 'CAMBIAR_DESCUENTO'; nuevoDescuento: number }
  | { op: 'REEMPLAZAR_PAGOS'; pagos: PagoData[] }
  | { op: 'AJUSTAR_FECHAS'; nuevaFechaInicio: string; nuevaFechaFin: string }
  | { op: 'CAMBIAR_PAQUETE'; idPaqueteNuevo: number };

export interface MembresiaPatchRequest {
  acciones: MembresiaPatchAction[];
}
