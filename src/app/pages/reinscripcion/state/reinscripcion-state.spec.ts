// src/app/pages/reinscripcion/state/reinscripcion-state.spec.ts
import { reinscripcionReducer } from './reinscripcion-reducer';
import { ReinscripcionActions } from './reinscripcion-actions';
import { initialReinscripcionState } from './reinscripcion-models';
import {
  selectPaqueteActual,
  selectPrecioPaquete,
  selectTotalVista,
  selectTotalSinDescuento,
  selectFechaPagoVista,
} from './reinscripcion-selectors';
import { PaqueteData } from '../../../model/paquete-data';
import { TiempoPlan } from '../../../util/enums/tiempo-plan';

describe('Reinscripcion State', () => {
  describe('Reducer', () => {
    it('should initialize with correct default state', () => {
      const state = reinscripcionReducer(undefined, { type: 'NOOP' });
      expect(state.listaPaquetes).toEqual([]);
      expect(state.paqueteId).toBe(0);
      expect(state.descuento).toBe(0);
      expect(state.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    describe('setListaPaquetes action', () => {
      it('should replace listaPaquetes and keep other fields untouched', () => {
        const initialState = {
          listaPaquetes: [],
          paqueteId: 5,
          descuento: 50,
          fechaInicio: '2026-03-01',
        };
        const p1: PaqueteData = {
          idPaquete: 1,
          nombre: 'Mensual',
          precio: 500,
          tiempo: TiempoPlan.MENSUAL,
          costoInscripcion: 150,
          activo: true,
        };
        const p2: PaqueteData = {
          idPaquete: 2,
          nombre: 'Trimestral',
          precio: 1200,
          tiempo: TiempoPlan.TRIMESTRAL,
          costoInscripcion: 150,
          activo: true,
        };

        const action = ReinscripcionActions.setListaPaquetes({ paquetes: [p1, p2] });
        const nextState = reinscripcionReducer(initialState, action);

        expect(nextState.listaPaquetes).toEqual([p1, p2]);
        expect(nextState.paqueteId).toBe(5);
        expect(nextState.descuento).toBe(50);
        expect(nextState.fechaInicio).toBe('2026-03-01');
      });
    });

    describe('setPaqueteId action', () => {
      it('should change only paqueteId', () => {
        const initialState = {
          listaPaquetes: [
            {
              idPaquete: 1,
              nombre: 'Mensual',
              precio: 500,
              tiempo: TiempoPlan.MENSUAL,
              costoInscripcion: 150,
              activo: true,
            },
          ],
          paqueteId: 1,
          descuento: 50,
          fechaInicio: '2026-03-01',
        };

        const action = ReinscripcionActions.setPaqueteId({ paqueteId: 2 });
        const nextState = reinscripcionReducer(initialState, action);

        expect(nextState.paqueteId).toBe(2);
        expect(nextState.listaPaquetes).toEqual(initialState.listaPaquetes);
        expect(nextState.descuento).toBe(50);
        expect(nextState.fechaInicio).toBe('2026-03-01');
      });
    });

    describe('setDescuento action', () => {
      it('should change only descuento', () => {
        const initialState = {
          listaPaquetes: [],
          paqueteId: 5,
          descuento: 0,
          fechaInicio: '2026-03-01',
        };

        const action = ReinscripcionActions.setDescuento({ descuento: 100 });
        const nextState = reinscripcionReducer(initialState, action);

        expect(nextState.descuento).toBe(100);
        expect(nextState.paqueteId).toBe(5);
        expect(nextState.listaPaquetes).toEqual([]);
        expect(nextState.fechaInicio).toBe('2026-03-01');
      });
    });

    describe('setFechaInicio action', () => {
      it('should change only fechaInicio', () => {
        const initialState = {
          listaPaquetes: [],
          paqueteId: 3,
          descuento: 75,
          fechaInicio: '2026-01-01',
        };

        const action = ReinscripcionActions.setFechaInicio({ fechaInicio: '2026-03-10' });
        const nextState = reinscripcionReducer(initialState, action);

        expect(nextState.fechaInicio).toBe('2026-03-10');
        expect(nextState.paqueteId).toBe(3);
        expect(nextState.descuento).toBe(75);
        expect(nextState.listaPaquetes).toEqual([]);
      });
    });

    describe('reset action', () => {
      it('should return to initial state', () => {
        const modifiedState = {
          listaPaquetes: [
            {
              idPaquete: 1,
              nombre: 'Mensual',
              precio: 500,
              tiempo: TiempoPlan.MENSUAL,
              costoInscripcion: 150,
              activo: true,
            },
          ],
          paqueteId: 10,
          descuento: 200,
          fechaInicio: '2026-05-15',
        };

        const action = ReinscripcionActions.reset();
        const nextState = reinscripcionReducer(modifiedState, action);

        expect(nextState.listaPaquetes).toEqual(initialReinscripcionState.listaPaquetes);
        expect(nextState.paqueteId).toBe(initialReinscripcionState.paqueteId);
        expect(nextState.descuento).toBe(initialReinscripcionState.descuento);
        expect(nextState.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  describe('Selectors', () => {
    const p1: PaqueteData = {
      idPaquete: 1,
      nombre: 'Mensual',
      precio: 500,
      tiempo: TiempoPlan.MENSUAL,
      costoInscripcion: 150,
      activo: true,
    };

    const p2: PaqueteData = {
      idPaquete: 2,
      nombre: 'Trimestral',
      precio: 1200,
      tiempo: TiempoPlan.TRIMESTRAL,
      costoInscripcion: 150,
      activo: true,
    };

    describe('selectPaqueteActual', () => {
      // AS-IS (negocio): reinscripción busca SOLO por idPaquete (Number === Number)
      // sin fallbacks a paqueteId/id/id_paquete (menos robusta que inscripción)
      it('should find paquete by idPaquete', () => {
        const lista = [p1, p2];
        const id = 1;
        const result = selectPaqueteActual.projector(lista, id);
        expect(result).toEqual(p1);
      });

      it('should return null when paquete not found', () => {
        const lista = [p1, p2];
        const id = 999;
        const result = selectPaqueteActual.projector(lista, id);
        expect(result).toBeNull();
      });

      it('should handle empty lista', () => {
        const lista: PaqueteData[] = [];
        const id = 1;
        const result = selectPaqueteActual.projector(lista, id);
        expect(result).toBeNull();
      });
    });

    // Fixtures deliberadamente malformados: los selectors defienden contra
    // datos sucios del backend; el cast está justificado y acotado a este describe.
    describe('selectPrecioPaquete', () => {
      it('should return precio from paquete', () => {
        const result = selectPrecioPaquete.projector(p1);
        expect(result).toBe(500);
      });

      it('should return 0 when paquete is null', () => {
        const result = selectPrecioPaquete.projector(null);
        expect(result).toBe(0);
      });

      it('should return 0 when precio is undefined', () => {
        const paqueteNoPrecio = { ...p1, precio: undefined } as any;
        const result = selectPrecioPaquete.projector(paqueteNoPrecio);
        expect(result).toBe(0);
      });

      it('should coerce precio to number', () => {
        const paqueteStringPrecio = { ...p1, precio: '500' } as any;
        const result = selectPrecioPaquete.projector(paqueteStringPrecio);
        expect(result).toBe(500);
      });
    });

    describe('selectTotalSinDescuento', () => {
      // AS-IS (negocio): la reinscripción devuelve el precio RAW,
      // sin costoInscripción (a diferencia de inscripción)
      it('should return raw precio without costoInscripcion', () => {
        // precio: 500 (no se suma costoInscripción como en inscripción)
        const result = selectTotalSinDescuento.projector(500);
        expect(result).toBe(500);
      });

      it('should return 0 when precio is 0', () => {
        const result = selectTotalSinDescuento.projector(0);
        expect(result).toBe(0);
      });
    });

    describe('selectTotalVista', () => {
      // AS-IS (negocio): la reinscripción no cobra costo de inscripción
      it('should calculate total as precio - descuento without costoInscripcion', () => {
        // precio: 500, descuento: 100
        // formula: precio - descuento = 500 - 100 = 400 (NO suma costoInscripción)
        const result = selectTotalVista.projector(500, 100);
        expect(result).toBe(400);
      });

      it('should return correct total with zero descuento', () => {
        // 500 - 0 = 500
        const result = selectTotalVista.projector(500, 0);
        expect(result).toBe(500);
      });

      it('should handle all zeros', () => {
        const result = selectTotalVista.projector(0, 0);
        expect(result).toBe(0);
      });

      it('should clamp negative results to 0', () => {
        // 100 - 500 = -400, but should be 0 due to Math.max(0, ...)
        const result = selectTotalVista.projector(100, 500);
        expect(result).toBe(0);
      });

      // AS-IS (negocio): a diferencia de inscripción (calcularTotal redondea a 2 decimales),
      // aquí NO hay redondeo: el resultado conserva la precisión cruda de la resta.
      // 100.105 - 0.005 = 100.10000000000001 en IEEE754 (redondeado sería 100.1).
      it('no redondea decimales (asimetría vs inscripción)', () => {
        expect(selectTotalVista.projector(100.105, 0.005)).toBe(100.10000000000001);
      });
    });

    describe('selectFechaPagoVista', () => {
      // AS-IS (negocio): devuelve fechaInicio SIN cambios
      // (a diferencia de inscripción que calcula una fecha fin)
      it('should return fechaInicio unchanged', () => {
        const inicio = '2026-03-10';
        const result = selectFechaPagoVista.projector(inicio);
        expect(result).toBe('2026-03-10');
      });

      it('should return empty string when inicio is empty', () => {
        const result = selectFechaPagoVista.projector('');
        expect(result).toBe('');
      });
    });
  });
});
