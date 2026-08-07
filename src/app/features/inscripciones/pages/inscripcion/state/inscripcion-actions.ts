// src/app/pages/inscripcion/state/inscripcion-actions.ts
import { createActionGroup, props, emptyProps } from '@ngrx/store';
import { PaqueteData } from '../../../../../shared/models/paquete-data';

export const InscripcionActions = createActionGroup({
  source: 'Inscripcion',
  events: {
    'Set Lista Paquetes': props<{ paquetes: PaqueteData[] }>(),
    'Set Paquete Id': props<{ paqueteId: number }>(),
    'Set Descuento': props<{ descuento: number }>(), // ✅ MONTO
    'Set Fecha Inicio': props<{ fechaInicio: string }>(),
    Reset: emptyProps(),
  },
});
