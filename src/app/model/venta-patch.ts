// src/app/model/venta-patch.ts
import { PagoData } from './membresia-data';

export type VentaPatchAction =
  | { op: 'CAMBIAR_CANTIDAD'; idDetalle: number; nuevaCantidad: number }
  | { op: 'REEMPLAZAR_PAGOS'; pagos: PagoData[] }
  | { op: 'REEMPLAZAR_PRODUCTO'; idDetalle: number; idProductoNuevo: number; cantidad: number }
  | { op: 'AGREGAR_DETALLE'; idProducto: number; cantidad: number }
  | { op: 'ANULAR' };

export interface VentaPatchRequest {
  acciones: VentaPatchAction[];
}
