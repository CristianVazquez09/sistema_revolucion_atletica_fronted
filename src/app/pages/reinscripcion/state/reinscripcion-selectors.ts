import { createSelector } from '@ngrx/store';
import { selectReinscripcionState } from './reinscripcion-reducer';
import { calcularFechaFin, calcularTotal } from '../../../util/fechas-precios';

export const selectListaPaquetes = createSelector(selectReinscripcionState, s => s.listaPaquetes);
export const selectPaqueteId     = createSelector(selectReinscripcionState, s => s.paqueteId);
export const selectDescuento     = createSelector(selectReinscripcionState, s => s.descuento);
export const selectFechaInicio   = createSelector(selectReinscripcionState, s => s.fechaInicio);

export const selectPaqueteActual = createSelector(
  selectListaPaquetes, selectPaqueteId,
  (lista, id) => lista.find(p => p.idPaquete === id) ?? null
);

export const selectPrecioPaquete = createSelector(selectPaqueteActual, p => p?.precio ?? 0);

export const selectTotalVista = createSelector(
  selectPrecioPaquete, selectDescuento,
  (precio, descuento) => calcularTotal(precio, descuento) // reinscripción no cobra inscripción
);

export const selectTotalSinDescuento = createSelector(
  selectPrecioPaquete,
  (precio) => calcularTotal(precio, 0)
);

export const selectFechaPagoVista = createSelector(
  selectFechaInicio, selectPaqueteActual,
  (inicio, p) => calcularFechaFin(inicio, p?.tiempo ?? null)
);
