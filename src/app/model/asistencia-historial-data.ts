import { PaqueteData } from "./paquete-data";

export interface AsistenciaHistorialData {
  idAsistencia: number;
  fechaHora: string; // ISO
  origen: 'HUELLA' | 'MANUAL' | string;

  socio: {
    idSocio: number;
    nombre: string;
    apellido: string;
    telefono?: string;
  };

  gimnasio?: {
    id?: number;
    nombre?: string;
  };
  
  // NUEVO: paquete asociado a esa asistencia (histórico)
  paquete?: PaqueteData | null;
}
