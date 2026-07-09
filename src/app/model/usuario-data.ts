import { GimnasioData } from '../shared/models/gimnasio-data';
import { RolData } from '../shared/models/rol-data';

export interface UsuarioData {
  id?: number;
  nombreUsuario: string;
  nombre?: string;
  apellido?: string;
  activo: boolean;
  roles: RolData[];
  gimnasio?: GimnasioData;
}
