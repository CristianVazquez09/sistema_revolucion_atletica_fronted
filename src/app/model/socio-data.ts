import { GimnasioData } from "./gimnasio-data";

// src/app/model/socio.ts
export interface SocioData {
  idSocio: number;
  nombre: string;
  apellido: string;
  direccion: string;
  telefono: string;
  email: string;
  fechaNacimiento: string; // ISO 'YYYY-MM-DD'
  genero: 'MASCULINO' | 'FEMENINO' | 'OTRO';
  comentarios?: string;
  activo?: boolean;
  gimnasio?: GimnasioData;

  huellaDigital?: string;

  // ✅ NUEVO: Vigencia de credencial de estudiante (opcional)
  credencialEstudianteVigencia?: string | null;
}
