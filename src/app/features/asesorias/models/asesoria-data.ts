
import { TiempoPlan } from '../../../shared/util/enums/tiempo-plan';
import { EntrenadorData } from '../../../shared/models/entrenador-data';
import { GimnasioData } from '../../../shared/models/gimnasio-data';
import { PagoData } from '../../../shared/models/membresia-data';
import { SocioData } from '../../../shared/models/socio-data';
import { TipoAsesoria } from '../../../shared/models/asesoria-contrato-data';

export interface AsesoriaCreateRequest {
  precio: number;
  tiempo: TiempoPlan;
  entrenador: EntrenadorData;
  socio: SocioData;
  pagos: PagoData[]; // { tipoPago: 'EFECTIVO'|'TARJETA'|'TRANSFERENCIA', monto: number, fechaPago?: string }
  gimnasio?: GimnasioData; // solo admin
  tipoAsesoria?: TipoAsesoria;
}
