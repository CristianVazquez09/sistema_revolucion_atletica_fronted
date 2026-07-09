// src/app/model/promocion-data.ts
import { TipoPromocion } from '../util/enums/tipo-promocion';
import { GimnasioData } from './gimnasio-data';
import { PaqueteData } from './paquete-data';

export interface PromocionUpsertData {
  nombre: string;
  descripcion?: string | null;

  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD

  tipo: TipoPromocion | string;

  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  mesesGratis?: number | null;

  soloNuevos?: boolean;
  sinCostoInscripcion?: boolean;

  prioridad?: number;

  activo?: boolean;

  // ✅ ADMIN: destino (se manda en request)
  gimnasio?: { id: number };
}

export interface PromocionData {
  idPromocion: number;

  nombre: string;
  descripcion?: string | null;

  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD

  tipo: TipoPromocion | string;

  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  mesesGratis?: number | null;

  soloNuevos?: boolean;
  sinCostoInscripcion?: boolean;

  prioridad?: number;

  activo: boolean;

  // ✅ viene del backend
  gimnasio?: GimnasioData;

  // opcional (si tu backend lo manda)
  paquetes?: PaqueteData[];
}
