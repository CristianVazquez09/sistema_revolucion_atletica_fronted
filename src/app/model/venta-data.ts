import { PagoData } from './membresia-data';
import { DetalleVentaData } from './detalle-venta-data';

/** Respuesta del backend para una venta */
export interface VentaData {
  idVenta?: number;
  fecha?: string;            // la coloca tu backend
  total: number;
  pagos: PagoData[];         // 👈 reemplaza al tipoPago único
  detalles: DetalleVentaData[];
}
