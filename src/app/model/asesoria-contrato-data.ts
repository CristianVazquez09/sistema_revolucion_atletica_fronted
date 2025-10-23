import { TiempoPlan } from '../util/enums/tiempo-plan';
import { EntrenadorData } from './entrenador-data';
import { GimnasioData } from './gimnasio-data';
import { PagoData } from './membresia-data';
import { SocioData } from './socio-data';

export interface AsesoriaContratoData {
  idAsesoriaPersonalizada: number;
  precio: number;
  tiempo: TiempoPlan;                  // p.ej. "TRES_MESES"
  entrenador?: EntrenadorData;  // opcional por seguridad
  socio?: SocioData | null;
  pagos?: PagoData[] | null;
  gimnasio?: GimnasioData | null;
  activo?: boolean;                // por si el backend lo incluye en otros endpoints
}
