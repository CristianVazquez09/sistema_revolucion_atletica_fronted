import { createActionGroup, props, emptyProps } from '@ngrx/store';
import { PaqueteData } from '../../../model/paquete-data';

export const ReinscripcionActions = createActionGroup({
  source: 'Reinscripcion',
  events: {
    'Set Lista Paquetes': props<{ paquetes: PaqueteData[] }>(),
    'Set Paquete Id':     props<{ paqueteId: number }>(),
    'Set Descuento':      props<{ descuento: number }>(),
    'Set Fecha Inicio':   props<{ fechaInicio: string }>(),
    'Reset':              emptyProps(),
  }
});
