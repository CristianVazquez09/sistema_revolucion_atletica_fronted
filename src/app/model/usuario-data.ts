import { GimnasioData } from './gimnasio-data';
import { RolData } from './rol-data';

export interface UsuarioData {
  id?: number;
  nombreUsuario: string;
  activo: boolean;
  roles: RolData[]; 
  gimnasio?: GimnasioData;      // en GET viene como arreglo
}
