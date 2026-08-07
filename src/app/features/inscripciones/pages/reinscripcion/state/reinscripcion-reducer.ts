// src/app/pages/reinscripcion/state/reinscripcion-reducer.ts
import { createFeature, createReducer, on } from '@ngrx/store';
import { initialReinscripcionState } from './reinscripcion-models';
import { ReinscripcionActions } from './reinscripcion-actions';

const reducer = createReducer(
  initialReinscripcionState,
  on(ReinscripcionActions.setListaPaquetes, (s, { paquetes }) => ({ ...s, listaPaquetes: paquetes })),
  on(ReinscripcionActions.setPaqueteId,     (s, { paqueteId }) => ({ ...s, paqueteId })),
  on(ReinscripcionActions.setDescuento,     (s, { descuento }) => ({ ...s, descuento })),
  on(ReinscripcionActions.setFechaInicio,   (s, { fechaInicio }) => ({ ...s, fechaInicio })),
  on(ReinscripcionActions.reset,            () => ({ ...initialReinscripcionState })),
);

export const reinscripcionFeature = createFeature({
  name: 'reinscripcion',
  reducer,
});

export const {
  name: REINSCRIPCION_FEATURE_KEY,
  reducer: reinscripcionReducer,
  // 👇 Selector base ya creado por createFeature
  selectReinscripcionState,
} = reinscripcionFeature;
