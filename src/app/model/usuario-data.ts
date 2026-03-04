import { GimnasioData } from './gimnasio-data';
import { RolData } from './rol-data';

export interface UsuarioData {
  id?: number;
  nombreUsuario: string;
  nombre?: string;
  apellido?: string;
  activo: boolean;
  roles: RolData[];
  gimnasio?: GimnasioData;
}
