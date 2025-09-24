// src/app/pages/inscripcion/state/inscripcion.selectors.ts
import { createSelector } from '@ngrx/store';
import { calcularFechaFin, calcularTotal } from '../../../util/fechas-precios';
import { selectInscripcionState } from './inscripcion-reducer';

export const selectListaPaquetes   = createSelector(selectInscripcionState, s => s.listaPaquetes);
export const selectPaqueteId       = createSelector(selectInscripcionState, s => s.paqueteId);
export const selectDescuento       = createSelector(selectInscripcionState, s => s.descuento);
export const selectFechaInicio     = createSelector(selectInscripcionState, s => s.fechaInicio);

export const selectPaqueteActual = createSelector(
  selectListaPaquetes, selectPaqueteId,
  (lista, id) => lista.find(p => p.idPaquete === id) ?? null
);

export const selectPrecioPaquete = createSelector(
  selectPaqueteActual, p => p?.precio ?? 0
);

export const selectCostoInscripcion = createSelector(
  selectPaqueteActual, p => p?.costoInscripcion ?? 0
);

export const selectTotalVista = createSelector(
  selectPrecioPaquete, selectDescuento, selectCostoInscripcion,
  (precio, descuento, insc) => calcularTotal(precio, descuento, insc)
);

export const selectTotalSinDescuento = createSelector(
  selectPrecioPaquete, selectCostoInscripcion,
  (precio, insc) => calcularTotal(precio, 0, insc)
);

export const selectFechaPagoVista = createSelector(
  selectFechaInicio, selectPaqueteActual,
  (inicio, p) => calcularFechaFin(inicio, p?.tiempo ?? null)
);
