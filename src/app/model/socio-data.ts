// src/app/model/socio.ts
export interface SocioData {
  idSocio: number;
  nombre: string;
  apellido: string;
  direccion: string;
  telefono: string;
  email: string;
  fechaNacimiento: string; // ISO 'YYYY-MM-DD' o Date
  genero: 'MASCULINO' | 'FEMENINO' | 'OTRO';
  comentarios?: string;
}
