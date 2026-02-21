import { PagoData } from './membresia-data';
import { DetalleVentaData } from './detalle-venta-data';
import { UsuarioData } from './usuario-data';
import { GimnasioData } from './gimnasio-data';

/** Respuesta del backend para una venta */
export interface VentaData {
  idVenta?: number;
  folio?: number;
  fecha?: string;            // la coloca tu backend
  total: number;
  descuento?: number;        // descuento aplicado (0 si no hay)
  pagos: PagoData[];         // 👈 reemplaza al tipoPago único
  detalles: DetalleVentaData[];
  usuario?: UsuarioData
  gimnasio?: GimnasioData
}
