import { TipoMovimiento } from "../shared/util/enums/tipo-movimiento";
import { PagoData } from "../shared/models/membresia-data";


export interface HistorialData {
  idMembresia: number;
  fechaInicio: string;
  fechaFin: string;
  movimiento: TipoMovimiento;
  pagos: PagoData[];          // <-- reemplaza tipoPago
  paqueteNombre: string;
  socioNombreCompleto: string;
  descuento: number;
  total: number;
}
