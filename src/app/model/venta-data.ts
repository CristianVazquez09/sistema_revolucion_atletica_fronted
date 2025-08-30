import { TipoPago } from '../util/enums/tipo-pago';
import { DetalleVentaData } from './detalle-venta-data';

export interface VentaData {
  idVenta?: number; // opcional al crear
  fecha?: string; // la setea el backend y te la devuelve
  total: number;
  tipoPago: TipoPago;
  detalles: DetalleVentaData[];
}
