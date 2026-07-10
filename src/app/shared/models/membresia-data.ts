import { TipoMovimiento } from '../util/enums/tipo-movimiento';
import { TipoPago } from '../util/enums/tipo-pago';
import { GimnasioData } from './gimnasio-data';
import { PaqueteData } from './paquete-data';
import { SocioData } from './socio-data';
import { UsuarioData } from './usuario-data';

export interface PagoData {
  tipoPago: TipoPago;
  monto: number;
}

export interface MembresiaData {
  idMembresia?: number;
  folio?: number;
  socio: SocioData;
  paquete: PaqueteData;
  fechaInicio: string;  // YYYY-MM-DD
  fechaFin: string;     // YYYY-MM-DD
  movimiento: TipoMovimiento;
  pagos: PagoData[];
  descuento: number;
  total: number;
  visitasRestantes?: number | null;
  usuario?: UsuarioData;   // 👈 nuevo
  gimnasio?: GimnasioData
  
}
