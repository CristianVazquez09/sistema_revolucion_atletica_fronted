import { SocioData } from './socio-data';

export interface AsesoriaNutricionalData {
  id?: number;                 // backend: /{id}
  socio: SocioData;            // relación
  fechaInicio: string;         // ISO YYYY-MM-DD
  fechaFin: string;            // ISO YYYY-MM-DD
  activo?: boolean;            // si lo tienes en backend (si no, se ignora)
  telefono?: string;           // NO es del socio; si tu backend lo guarda aquí, si no, elimínalo
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface AsesoriaNutricionalUpsertDTO {
  idSocio: number;
  fechaInicio: string;         // YYYY-MM-DD
  fechaFin: string;            // YYYY-MM-DD
  telefono: string;            // ✅ obligatorio por tu regla
}

export interface AsesoriaNutricionalVigenciaDTO {
  vigente: boolean;
}
