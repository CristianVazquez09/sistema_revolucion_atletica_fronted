
import { TiempoPlan } from '../util/enums/tiempo-plan';
import { EntrenadorData } from './entrenador-data';
import { GimnasioData } from './gimnasio-data';
import { PagoData } from './membresia-data';
import { SocioData } from './socio-data';

export interface AsesoriaCreateRequest {
  precio: number;
  tiempo: TiempoPlan;
  entrenador: EntrenadorData;
  socio: SocioData;
  pagos: PagoData[]; // { tipoPago: 'EFECTIVO'|'TARJETA'|'TRANSFERENCIA', monto: number, fechaPago?: string }
  gimnasio?: GimnasioData; // solo admin
}



export interface AsesoriaCreateRequest {
  precio: number;
  tiempo: TiempoPlan;
  entrenador: EntrenadorData;
  socio: SocioData;
  pagos: PagoData[]; // { tipoPago: 'EFECTIVO'|'TARJETA'|'TRANSFERENCIA', monto: number, fechaPago?: string }
  gimnasio?: GimnasioData; // solo admin
}

