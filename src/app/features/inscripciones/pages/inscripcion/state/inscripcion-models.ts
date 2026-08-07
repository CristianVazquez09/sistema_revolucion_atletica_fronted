// src/app/pages/inscripcion/state/inscripcion-models.ts
import { PaqueteData } from '../../../../../shared/models/paquete-data';

export interface InscripcionState {
  listaPaquetes: PaqueteData[];
  paqueteId: number;   // seleccionado
  descuento: number;   // ✅ MONTO
  fechaInicio: string; // ISO (YYYY-MM-DD)
}

export const initialInscripcionState: InscripcionState = {
  listaPaquetes: [],
  paqueteId: 0,
  descuento: 0,
  fechaInicio: new Date().toISOString().slice(0, 10),
};
