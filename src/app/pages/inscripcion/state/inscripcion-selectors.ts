// src/app/pages/inscripcion/state/inscripcion-selectors.ts
import { createSelector } from '@ngrx/store';
import { calcularFechaFin, calcularTotal } from '../../../util/fechas-precios';
import { selectInscripcionState } from './inscripcion-reducer';

export const selectListaPaquetes = createSelector(
  selectInscripcionState,
  (s) => s.listaPaquetes
);

export const selectPaqueteId = createSelector(
  selectInscripcionState,
  (s) => s.paqueteId
);

export const selectDescuento = createSelector(
  selectInscripcionState,
  (s) => s.descuento
);

export const selectFechaInicio = createSelector(
  selectInscripcionState,
  (s) => s.fechaInicio
);

// ✅ Selector robusto: soporta string/number y llaves alternativas
const getId = (p: any): number => {
  const raw =
    p?.idPaquete ??
    p?.paqueteId ??
    p?.id ??
    p?.id_paquete ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

export const selectPaqueteActual = createSelector(
  selectListaPaquetes,
  selectPaqueteId,
  (lista, id) => {
    const pid = Number(id ?? 0);
    return (lista ?? []).find((p: any) => getId(p) === pid) ?? null;
  }
);

export const selectPrecioPaquete = createSelector(
  selectPaqueteActual,
  (p: any) => Number(p?.precio ?? 0) || 0
);

export const selectCostoInscripcion = createSelector(
  selectPaqueteActual,
  (p: any) => Number(p?.costoInscripcion ?? 0) || 0
);

export const selectTotalVista = createSelector(
  selectPrecioPaquete,
  selectDescuento,
  selectCostoInscripcion,
  (precio, descuento, insc) => calcularTotal(Number(precio) || 0, Number(descuento) || 0, Number(insc) || 0)
);

export const selectTotalSinDescuento = createSelector(
  selectPrecioPaquete,
  selectCostoInscripcion,
  (precio, insc) => calcularTotal(Number(precio) || 0, 0, Number(insc) || 0)
);

export const selectFechaPagoVista = createSelector(
  selectFechaInicio,
  selectPaqueteActual,
  (inicio, p: any) => calcularFechaFin(String(inicio ?? ''), p?.tiempo ?? null)
);
