import { TiempoPlan } from '../util/enums/tiempo-plan';
import { EntrenadorData } from './entrenador-data';
import { GimnasioData } from './gimnasio-data';
import { PagoData } from './membresia-data';
import { SocioData } from './socio-data';

export interface AsesoriaContratoData {
  idAsesoriaPersonalizada: number;
  precio: number;
  tiempo: TiempoPlan;                 // p.ej. "TRES_MESES"
  entrenador?: EntrenadorData;        // opcional por seguridad
  socio?: SocioData | null;
  pagos?: PagoData[] | null;
  gimnasio?: GimnasioData | null;

  // Nuevo backend:
  fecha?: string | null;              // READ_ONLY en backend
  vigenteHasta?: string | null;       // READ_ONLY en backend (se usa para Vigente)

  // lo puedes dejar por compatibilidad, pero ya NO lo usaremos para pintar la tabla
  activo?: boolean;
}
