// src/app/model/venta-create.ts
import { TipoPago } from '../util/enums/tipo-pago';

export interface DetalleVentaCreate {
  idProducto: number;
  cantidad: number;
}

export interface VentaCreateRequest {
  tipoPago: TipoPago;
  detalles: DetalleVentaCreate[];
}
