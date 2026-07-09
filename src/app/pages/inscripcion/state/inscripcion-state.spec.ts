// src/app/pages/inscripcion/state/inscripcion-state.spec.ts
import { inscripcionReducer } from './inscripcion-reducer';
import { InscripcionActions } from './inscripcion-actions';
import { initialInscripcionState } from './inscripcion-models';
import {
  selectPaqueteActual,
  selectPrecioPaquete,
  selectCostoInscripcion,
  selectTotalVista,
  selectTotalSinDescuento,
  selectFechaPagoVista,
} from './inscripcion-selectors';
import { PaqueteData } from '../../../model/paquete-data';
import { TiempoPlan } from '../../../util/enums/tiempo-plan';

describe('Inscripcion State', () => {
  describe('Reducer', () => {
    it('should initialize with correct default state', () => {
      const state = inscripcionReducer(undefined, { type: 'NOOP' });
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

        const action = InscripcionActions.setListaPaquetes({ paquetes: [p1, p2] });
        const nextState = inscripcionReducer(initialState, action);

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

        const action = InscripcionActions.setPaqueteId({ paqueteId: 2 });
        const nextState = inscripcionReducer(initialState, action);

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

        const action = InscripcionActions.setDescuento({ descuento: 100 });
        const nextState = inscripcionReducer(initialState, action);

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

        const action = InscripcionActions.setFechaInicio({ fechaInicio: '2026-03-10' });
        const nextState = inscripcionReducer(initialState, action);

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

        const action = InscripcionActions.reset();
        const nextState = inscripcionReducer(modifiedState, action);

        expect(nextState.listaPaquetes).toEqual(initialInscripcionState.listaPaquetes);
        expect(nextState.paqueteId).toBe(initialInscripcionState.paqueteId);
        expect(nextState.descuento).toBe(initialInscripcionState.descuento);
        expect(nextState.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  describe('Selectors', () => {
    // Tipo local para ejercitar los fallbacks de getId del selector
    // (paqueteId / id / id_paquete). getId prueba idPaquete PRIMERO,
    // por lo que estos fixtures deben OMITIR idPaquete para llegar a
    // las llaves alternas. Un cast por fixture, acotado a este tipo.
    type PaqueteConIdsAlternos = Omit<PaqueteData, 'idPaquete'> & {
      paqueteId?: number;
      id?: number;
      id_paquete?: number;
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

    describe('selectPaqueteActual', () => {
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

      it('should find paquete using paqueteId field', () => {
        const paqueteConPaqueteId: PaqueteConIdsAlternos = {
          paqueteId: 3,
          nombre: 'Test',
          precio: 100,
          tiempo: TiempoPlan.MENSUAL,
          costoInscripcion: 50,
          activo: true,
        };
        const lista = [paqueteConPaqueteId] as PaqueteData[];
        const id = 3;
        const result = selectPaqueteActual.projector(lista, id);
        expect(result).toEqual(paqueteConPaqueteId as PaqueteData);
      });

      it('should find paquete using id field', () => {
        const paqueteConId: PaqueteConIdsAlternos = {
          id: 5,
          nombre: 'Test',
          precio: 100,
          tiempo: TiempoPlan.MENSUAL,
          costoInscripcion: 50,
          activo: true,
        };
        const lista = [paqueteConId] as PaqueteData[];
        const id = 5;
        const result = selectPaqueteActual.projector(lista, id);
        expect(result).toEqual(paqueteConId as PaqueteData);
      });

      it('should find paquete using id_paquete field', () => {
        const paqueteConIdPaqueteSnake: PaqueteConIdsAlternos = {
          id_paquete: 6,
          nombre: 'Test',
          precio: 100,
          tiempo: TiempoPlan.MENSUAL,
          costoInscripcion: 50,
          activo: true,
        };
        const lista = [paqueteConIdPaqueteSnake] as PaqueteData[];
        const id = 6;
        const result = selectPaqueteActual.projector(lista, id);
        expect(result).toEqual(paqueteConIdPaqueteSnake as PaqueteData);
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

    describe('selectCostoInscripcion', () => {
      it('should return costoInscripcion from paquete', () => {
        const result = selectCostoInscripcion.projector(p1);
        expect(result).toBe(150);
      });

      it('should return 0 when paquete is null', () => {
        const result = selectCostoInscripcion.projector(null);
        expect(result).toBe(0);
      });

      it('should return 0 when costoInscripcion is undefined', () => {
        const paqueteNoInsc = { ...p1, costoInscripcion: undefined } as any;
        const result = selectCostoInscripcion.projector(paqueteNoInsc);
        expect(result).toBe(0);
      });

      it('should coerce costoInscripcion to number', () => {
        const paqueteStringInsc = { ...p1, costoInscripcion: '150' } as any;
        const result = selectCostoInscripcion.projector(paqueteStringInsc);
        expect(result).toBe(150);
      });
    });

    describe('selectTotalVista', () => {
      it('should calculate total with precio, descuento, and costoInscripcion', () => {
        // precio: 500, descuento: 100, costoInscripcion: 150
        // formula: (precio + costoInscripcion) - descuento = (500 + 150) - 100 = 550
        const result = selectTotalVista.projector(500, 100, 150);
        expect(result).toBe(550);
      });

      it('should return correct total with zero descuento', () => {
        // (500 + 150) - 0 = 650
        const result = selectTotalVista.projector(500, 0, 150);
        expect(result).toBe(650);
      });

      it('should handle all zeros', () => {
        const result = selectTotalVista.projector(0, 0, 0);
        expect(result).toBe(0);
      });

      it('should handle negative results as 0', () => {
        // (100 + 50) - 500 = -350, but should be 0 due to Math.max(0, ...)
        const result = selectTotalVista.projector(100, 500, 50);
        expect(result).toBe(0);
      });
    });

    describe('selectTotalSinDescuento', () => {
      it('should calculate total without descuento', () => {
        // precio: 500, costoInscripcion: 150
        // formula: (500 + 150) - 0 = 650
        const result = selectTotalSinDescuento.projector(500, 150);
        expect(result).toBe(650);
      });

      it('should return correct total with zero costoInscripcion', () => {
        // (500 + 0) - 0 = 500
        const result = selectTotalSinDescuento.projector(500, 0);
        expect(result).toBe(500);
      });

      it('should return correct total with all zeros', () => {
        const result = selectTotalSinDescuento.projector(0, 0);
        expect(result).toBe(0);
      });
    });

    describe('selectFechaPagoVista', () => {
      it('should calculate fecha fin for MENSUAL (UN_MES)', () => {
        const inicio = '2026-03-10';
        const paquete = p1; // tiempo: TiempoPlan.MENSUAL (value: 'UN_MES')
        const result = selectFechaPagoVista.projector(inicio, paquete);
        expect(result).toBe('2026-04-10');
      });

      it('should calculate fecha fin for TRIMESTRAL (TRES_MESES)', () => {
        const inicio = '2026-03-10';
        const paqueteTrimestral = {
          ...p1,
          tiempo: TiempoPlan.TRIMESTRAL,
        };
        const result = selectFechaPagoVista.projector(inicio, paqueteTrimestral);
        expect(result).toBe('2026-06-10');
      });

      it('should return hoyISO when inicio is empty', () => {
        const paquete = p1;
        const result = selectFechaPagoVista.projector('', paquete);
        // Should be today's date in ISO format
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle null paquete gracefully', () => {
        const inicio = '2026-03-10';
        const result = selectFechaPagoVista.projector(inicio, null);
        // Should fallback to default 1 month (addMonths(1))
        expect(result).toBe('2026-04-10');
      });

      it('should handle null tiempo in paquete as default', () => {
        const inicio = '2026-03-10';
        const paqueteNoTiempo = { ...p1, tiempo: null } as any;
        const result = selectFechaPagoVista.projector(inicio, paqueteNoTiempo);
        // Should fallback to default 1 month (addMonths(1))
        expect(result).toBe('2026-04-10');
      });
    });
  });
});
