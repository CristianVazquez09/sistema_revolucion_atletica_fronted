// Portado de src/app/pages/inscripcion/state/inscripcion-state.spec.ts
// Mismos casos, mismos valores esperados. Adaptado de "dispatch action + leer
// selector desde un store de prueba" a "llamar método + leer computed signal
// directamente sobre una instancia de InscripcionStore".
import { TestBed } from '@angular/core/testing';
import { InscripcionStore } from './inscripcion-store';
import { PaqueteData } from '../../../shared/models/paquete-data';
import { TiempoPlan } from '../../../shared/util/enums/tiempo-plan';

describe('InscripcionStore', () => {
  let store: InscripcionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(InscripcionStore);
  });

  describe('estado inicial / mutadores', () => {
    it('should initialize with correct default state', () => {
      expect(store.listaPaquetes()).toEqual([]);
      expect(store.paqueteId()).toBe(0);
      expect(store.descuento()).toBe(0);
      expect(store.fechaInicio()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    describe('establecerListaPaquetes', () => {
      it('should replace listaPaquetes and keep other fields untouched', () => {
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

        store.establecerPaqueteId(5);
        store.establecerDescuento(50);
        store.establecerFechaInicio('2026-03-01');

        store.establecerListaPaquetes([p1, p2]);

        expect(store.listaPaquetes()).toEqual([p1, p2]);
        expect(store.paqueteId()).toBe(5);
        expect(store.descuento()).toBe(50);
        expect(store.fechaInicio()).toBe('2026-03-01');
      });
    });

    describe('establecerPaqueteId', () => {
      it('should change only paqueteId', () => {
        const lista: PaqueteData[] = [
          {
            idPaquete: 1,
            nombre: 'Mensual',
            precio: 500,
            tiempo: TiempoPlan.MENSUAL,
            costoInscripcion: 150,
            activo: true,
          },
        ];
        store.establecerListaPaquetes(lista);
        store.establecerPaqueteId(1);
        store.establecerDescuento(50);
        store.establecerFechaInicio('2026-03-01');

        store.establecerPaqueteId(2);

        expect(store.paqueteId()).toBe(2);
        expect(store.listaPaquetes()).toEqual(lista);
        expect(store.descuento()).toBe(50);
        expect(store.fechaInicio()).toBe('2026-03-01');
      });
    });

    describe('establecerDescuento', () => {
      it('should change only descuento', () => {
        store.establecerPaqueteId(5);
        store.establecerFechaInicio('2026-03-01');

        store.establecerDescuento(100);

        expect(store.descuento()).toBe(100);
        expect(store.paqueteId()).toBe(5);
        expect(store.listaPaquetes()).toEqual([]);
        expect(store.fechaInicio()).toBe('2026-03-01');
      });
    });

    describe('establecerFechaInicio', () => {
      it('should change only fechaInicio', () => {
        store.establecerPaqueteId(3);
        store.establecerDescuento(75);
        store.establecerFechaInicio('2026-01-01');

        store.establecerFechaInicio('2026-03-10');

        expect(store.fechaInicio()).toBe('2026-03-10');
        expect(store.paqueteId()).toBe(3);
        expect(store.descuento()).toBe(75);
        expect(store.listaPaquetes()).toEqual([]);
      });
    });

    describe('reiniciar', () => {
      it('should return to initial state', () => {
        const lista: PaqueteData[] = [
          {
            idPaquete: 1,
            nombre: 'Mensual',
            precio: 500,
            tiempo: TiempoPlan.MENSUAL,
            costoInscripcion: 150,
            activo: true,
          },
        ];
        store.establecerListaPaquetes(lista);
        store.establecerPaqueteId(10);
        store.establecerDescuento(200);
        store.establecerFechaInicio('2026-05-15');

        store.reiniciar();

        expect(store.listaPaquetes()).toEqual([]);
        expect(store.paqueteId()).toBe(0);
        expect(store.descuento()).toBe(0);
        expect(store.fechaInicio()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should restore the SAME fechaInicio value captured at module load, not a freshly computed "today"', () => {
        // El reducer de NgRx original usa `initialInscripcionState` (una constante de
        // módulo calculada UNA sola vez) y en `reset` hace `{ ...initialInscripcionState }`
        // — no recalcula `new Date()` en cada reset. Este store replica esa semántica:
        // dos llamadas a reiniciar() (incluso separadas por otras mutaciones) deben
        // producir siempre el mismo valor de fechaInicio.
        const fechaInicioTrasPrimerReset = store.fechaInicio();

        store.establecerFechaInicio('2026-05-15');
        store.reiniciar();
        const fechaInicioTrasSegundoReset = store.fechaInicio();

        expect(fechaInicioTrasSegundoReset).toBe(fechaInicioTrasPrimerReset);
      });
    });
  });

  describe('derivados', () => {
    // Tipo local para ejercitar los fallbacks de getId
    // (paqueteId / id / id_paquete). getId prueba idPaquete PRIMERO,
    // por lo que estos fixtures deben OMITIR idPaquete para llegar a
    // las llaves alternas. Un cast por fixture, acotado a este describe.
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

    describe('paqueteActual', () => {
      it('should find paquete by idPaquete', () => {
        store.establecerListaPaquetes([p1, p2]);
        store.establecerPaqueteId(1);
        expect(store.paqueteActual()).toEqual(p1);
      });

      it('should return null when paquete not found', () => {
        store.establecerListaPaquetes([p1, p2]);
        store.establecerPaqueteId(999);
        expect(store.paqueteActual()).toBeNull();
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
        store.establecerListaPaquetes([paqueteConPaqueteId] as PaqueteData[]);
        store.establecerPaqueteId(3);
        expect(store.paqueteActual()).toEqual(paqueteConPaqueteId as PaqueteData);
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
        store.establecerListaPaquetes([paqueteConId] as PaqueteData[]);
        store.establecerPaqueteId(5);
        expect(store.paqueteActual()).toEqual(paqueteConId as PaqueteData);
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
        store.establecerListaPaquetes([paqueteConIdPaqueteSnake] as PaqueteData[]);
        store.establecerPaqueteId(6);
        expect(store.paqueteActual()).toEqual(paqueteConIdPaqueteSnake as PaqueteData);
      });

      it('should handle empty lista', () => {
        store.establecerListaPaquetes([]);
        store.establecerPaqueteId(1);
        expect(store.paqueteActual()).toBeNull();
      });
    });

    // Fixtures deliberadamente malformados: los computed defienden contra
    // datos sucios del backend; el cast está justificado y acotado a este describe.
    describe('precioPaquete', () => {
      it('should return precio from paquete', () => {
        store.establecerListaPaquetes([p1]);
        store.establecerPaqueteId(1);
        expect(store.precioPaquete()).toBe(500);
      });

      it('should return 0 when paquete is null', () => {
        store.establecerListaPaquetes([]);
        store.establecerPaqueteId(1);
        expect(store.precioPaquete()).toBe(0);
      });

      it('should return 0 when precio is undefined', () => {
        const paqueteNoPrecio = { ...p1, precio: undefined } as any;
        store.establecerListaPaquetes([paqueteNoPrecio]);
        store.establecerPaqueteId(1);
        expect(store.precioPaquete()).toBe(0);
      });

      it('should coerce precio to number', () => {
        const paqueteStringPrecio = { ...p1, precio: '500' } as any;
        store.establecerListaPaquetes([paqueteStringPrecio]);
        store.establecerPaqueteId(1);
        expect(store.precioPaquete()).toBe(500);
      });
    });

    describe('costoInscripcion', () => {
      it('should return costoInscripcion from paquete', () => {
        store.establecerListaPaquetes([p1]);
        store.establecerPaqueteId(1);
        expect(store.costoInscripcion()).toBe(150);
      });

      it('should return 0 when paquete is null', () => {
        store.establecerListaPaquetes([]);
        store.establecerPaqueteId(1);
        expect(store.costoInscripcion()).toBe(0);
      });

      it('should return 0 when costoInscripcion is undefined', () => {
        const paqueteNoInsc = { ...p1, costoInscripcion: undefined } as any;
        store.establecerListaPaquetes([paqueteNoInsc]);
        store.establecerPaqueteId(1);
        expect(store.costoInscripcion()).toBe(0);
      });

      it('should coerce costoInscripcion to number', () => {
        const paqueteStringInsc = { ...p1, costoInscripcion: '150' } as any;
        store.establecerListaPaquetes([paqueteStringInsc]);
        store.establecerPaqueteId(1);
        expect(store.costoInscripcion()).toBe(150);
      });
    });

    describe('totalVista', () => {
      it('should calculate total with precio, descuento, and costoInscripcion', () => {
        // precio: 500, descuento: 100, costoInscripcion: 150
        // formula: (precio + costoInscripcion) - descuento = (500 + 150) - 100 = 550
        store.establecerListaPaquetes([p1]); // precio 500, costoInscripcion 150
        store.establecerPaqueteId(1);
        store.establecerDescuento(100);
        expect(store.totalVista()).toBe(550);
      });

      it('should return correct total with zero descuento', () => {
        // (500 + 150) - 0 = 650
        store.establecerListaPaquetes([p1]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(0);
        expect(store.totalVista()).toBe(650);
      });

      it('should handle all zeros', () => {
        const pZero: PaqueteData = { ...p1, precio: 0, costoInscripcion: 0 };
        store.establecerListaPaquetes([pZero]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(0);
        expect(store.totalVista()).toBe(0);
      });

      it('should handle negative results as 0', () => {
        // (100 + 50) - 500 = -350, but should be 0 due to Math.max(0, ...)
        const pNeg: PaqueteData = { ...p1, precio: 100, costoInscripcion: 50 };
        store.establecerListaPaquetes([pNeg]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(500);
        expect(store.totalVista()).toBe(0);
      });
    });

    describe('totalSinDescuento', () => {
      it('should calculate total without descuento', () => {
        // precio: 500, costoInscripcion: 150
        // formula: (500 + 150) - 0 = 650
        store.establecerListaPaquetes([p1]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(999); // no debe afectar a totalSinDescuento
        expect(store.totalSinDescuento()).toBe(650);
      });

      it('should return correct total with zero costoInscripcion', () => {
        // (500 + 0) - 0 = 500
        const pSinInsc: PaqueteData = { ...p1, precio: 500, costoInscripcion: 0 };
        store.establecerListaPaquetes([pSinInsc]);
        store.establecerPaqueteId(1);
        expect(store.totalSinDescuento()).toBe(500);
      });

      it('should return correct total with all zeros', () => {
        const pZero: PaqueteData = { ...p1, precio: 0, costoInscripcion: 0 };
        store.establecerListaPaquetes([pZero]);
        store.establecerPaqueteId(1);
        expect(store.totalSinDescuento()).toBe(0);
      });
    });

    describe('fechaPagoVista', () => {
      it('should calculate fecha fin for MENSUAL (UN_MES)', () => {
        store.establecerListaPaquetes([p1]); // tiempo: TiempoPlan.MENSUAL (value: 'UN_MES')
        store.establecerPaqueteId(1);
        store.establecerFechaInicio('2026-03-10');
        expect(store.fechaPagoVista()).toBe('2026-04-10');
      });

      it('should calculate fecha fin for TRIMESTRAL (TRES_MESES)', () => {
        const paqueteTrimestral: PaqueteData = { ...p1, tiempo: TiempoPlan.TRIMESTRAL };
        store.establecerListaPaquetes([paqueteTrimestral]);
        store.establecerPaqueteId(1);
        store.establecerFechaInicio('2026-03-10');
        expect(store.fechaPagoVista()).toBe('2026-06-10');
      });

      it('should return hoyISO when inicio is empty', () => {
        store.establecerListaPaquetes([p1]);
        store.establecerPaqueteId(1);
        store.establecerFechaInicio('');
        // Should be today's date in ISO format
        expect(store.fechaPagoVista()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('should handle null paquete gracefully', () => {
        store.establecerListaPaquetes([]); // ningún paquete coincide -> paqueteActual() === null
        store.establecerPaqueteId(1);
        store.establecerFechaInicio('2026-03-10');
        // Should fallback to default 1 month (addMonths(1))
        expect(store.fechaPagoVista()).toBe('2026-04-10');
      });

      it('should handle null tiempo in paquete as default', () => {
        const paqueteNoTiempo = { ...p1, tiempo: null } as any;
        store.establecerListaPaquetes([paqueteNoTiempo]);
        store.establecerPaqueteId(1);
        store.establecerFechaInicio('2026-03-10');
        // Should fallback to default 1 month (addMonths(1))
        expect(store.fechaPagoVista()).toBe('2026-04-10');
      });
    });
  });
});
