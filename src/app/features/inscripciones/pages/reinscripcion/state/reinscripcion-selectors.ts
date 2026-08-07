// src/app/pages/reinscripcion/state/reinscripcion-selectors.ts
import { createSelector } from '@ngrx/store';
import { selectReinscripcionState } from './reinscripcion-reducer';
import { ReinscripcionState } from './reinscripcion-models';

export const selectListaPaquetes = createSelector(
  selectReinscripcionState,
  (s: ReinscripcionState) => s.listaPaquetes
);

export const selectPaqueteId = createSelector(
  selectReinscripcionState,
  (s: ReinscripcionState) => s.paqueteId
);

export const selectDescuento = createSelector(
  selectReinscripcionState,
  (s: ReinscripcionState) => s.descuento
);

export const selectFechaInicio = createSelector(
  selectReinscripcionState,
  (s: ReinscripcionState) => s.fechaInicio
);

export const selectPaqueteActual = createSelector(
  selectListaPaquetes,
  selectPaqueteId,
  (lista, id) => lista.find(p => Number(p.idPaquete) === Number(id)) ?? null
);

export const selectPrecioPaquete = createSelector(
  selectPaqueteActual,
  (p) => Number(p?.precio ?? 0)
);

export const selectTotalSinDescuento = createSelector(
  selectPrecioPaquete,
  (precio) => precio
);

export const selectTotalVista = createSelector(
  selectPrecioPaquete,
  selectDescuento,
  (precio, descuento) => Math.max(0, Number(precio) - Number(descuento || 0))
);

export const selectFechaPagoVista = createSelector(
  selectFechaInicio,
  (f) => f
);
