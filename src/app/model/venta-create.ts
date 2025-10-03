import { TipoPago } from '../util/enums/tipo-pago';
import { PagoData } from './membresia-data';

export interface DetalleVentaCreate {
  idProducto: number;
  cantidad: number;
}

/** Ahora enviamos pagos[] en lugar de un solo tipoPago */
export interface VentaCreateRequest {
  pagos: PagoData[];                 // 👈 múltiple método de pago
  detalles: DetalleVentaCreate[];
}
