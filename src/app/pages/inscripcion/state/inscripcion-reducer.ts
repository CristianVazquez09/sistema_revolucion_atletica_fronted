// src/app/pages/inscripcion/state/inscripcion.reducer.ts
import { createFeature, createReducer, on } from '@ngrx/store';
import { initialInscripcionState } from './inscripcion-models';
import { InscripcionActions } from './inscripcion-actions';

const reducer = createReducer(
  initialInscripcionState,
  on(InscripcionActions.setListaPaquetes, (s, { paquetes }) => ({ ...s, listaPaquetes: paquetes })),
  on(InscripcionActions.setPaqueteId,     (s, { paqueteId })   => ({ ...s, paqueteId })),
  on(InscripcionActions.setDescuento,     (s, { descuento })   => ({ ...s, descuento })),
  on(InscripcionActions.setFechaInicio,   (s, { fechaInicio }) => ({ ...s, fechaInicio })),
  on(InscripcionActions.reset,            ()                   => ({ ...initialInscripcionState })),
);

export const inscripcionFeature = createFeature({
  name: 'inscripcion',
  reducer,
});

export const {
  name: INSCRIPCION_FEATURE_KEY,
  reducer: inscripcionReducer,
  selectInscripcionState,
} = inscripcionFeature;
