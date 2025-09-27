import { PaqueteData } from '../../../model/paquete-data';

export interface ReinscripcionState {
  listaPaquetes: PaqueteData[];
  paqueteId: number;
  descuento: number;
  fechaInicio: string; // YYYY-MM-DD
}

export const initialReinscripcionState: ReinscripcionState = {
  listaPaquetes: [],
  paqueteId: 0,
  descuento: 0,
  fechaInicio: new Date().toISOString().slice(0, 10),
};
