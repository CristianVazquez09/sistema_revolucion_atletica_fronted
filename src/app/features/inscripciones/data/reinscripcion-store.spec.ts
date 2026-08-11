// Portado de src/app/features/inscripciones/pages/reinscripcion/state/reinscripcion-state.spec.ts
// Mismos casos, mismos valores esperados. Adaptado de "dispatch action + leer
// selector desde un store de prueba" a "llamar método + leer computed signal
// directamente sobre una instancia de ReinscripcionStore".
import { TestBed } from '@angular/core/testing';
import { ReinscripcionStore } from './reinscripcion-store';
import { PaqueteData } from '../../../shared/models/paquete-data';
import { TiempoPlan } from '../../../shared/util/enums/tiempo-plan';

describe('ReinscripcionStore', () => {
  let store: ReinscripcionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ReinscripcionStore);
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
        // El reducer de NgRx original usa `initialReinscripcionState` (una constante
        // de módulo calculada UNA sola vez) y en `reset` hace `{ ...initialReinscripcionState }`
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
      // AS-IS (negocio): reinscripción busca SOLO por idPaquete (Number === Number)
      // sin fallbacks a paqueteId/id/id_paquete (menos robusta que inscripción)
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

    describe('totalSinDescuento', () => {
      // AS-IS (negocio): la reinscripción devuelve el precio RAW,
      // sin costoInscripción (a diferencia de inscripción)
      it('should return raw precio without costoInscripcion', () => {
        // precio: 500 (no se suma costoInscripción como en inscripción)
        store.establecerListaPaquetes([p1]); // precio 500, costoInscripcion 150
        store.establecerPaqueteId(1);
        expect(store.totalSinDescuento()).toBe(500);
      });

      it('should return 0 when precio is 0', () => {
        const pZero: PaqueteData = { ...p1, precio: 0 };
        store.establecerListaPaquetes([pZero]);
        store.establecerPaqueteId(1);
        expect(store.totalSinDescuento()).toBe(0);
      });
    });

    describe('totalVista', () => {
      // AS-IS (negocio): la reinscripción no cobra costo de inscripción
      it('should calculate total as precio - descuento without costoInscripcion', () => {
        // precio: 500, descuento: 100
        // formula: precio - descuento = 500 - 100 = 400 (NO suma costoInscripción)
        store.establecerListaPaquetes([p1]); // precio 500, costoInscripcion 150
        store.establecerPaqueteId(1);
        store.establecerDescuento(100);
        expect(store.totalVista()).toBe(400);
      });

      it('should return correct total with zero descuento', () => {
        // 500 - 0 = 500
        store.establecerListaPaquetes([p1]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(0);
        expect(store.totalVista()).toBe(500);
      });

      it('should handle all zeros', () => {
        const pZero: PaqueteData = { ...p1, precio: 0 };
        store.establecerListaPaquetes([pZero]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(0);
        expect(store.totalVista()).toBe(0);
      });

      it('should clamp negative results to 0', () => {
        // 100 - 500 = -400, but should be 0 due to Math.max(0, ...)
        const pCien: PaqueteData = { ...p1, precio: 100 };
        store.establecerListaPaquetes([pCien]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(500);
        expect(store.totalVista()).toBe(0);
      });

      // AS-IS (negocio): a diferencia de inscripción (calcularTotal redondea a 2 decimales),
      // aquí NO hay redondeo: el resultado conserva la precisión cruda de la resta.
      // 100.105 - 0.005 = 100.10000000000001 en IEEE754 (redondeado sería 100.1).
      it('no redondea decimales (asimetría vs inscripción)', () => {
        const pDecimal: PaqueteData = { ...p1, precio: 100.105 };
        store.establecerListaPaquetes([pDecimal]);
        store.establecerPaqueteId(1);
        store.establecerDescuento(0.005);
        expect(store.totalVista()).toBe(100.10000000000001);
      });
    });

    describe('fechaPagoVista', () => {
      // AS-IS (negocio): devuelve fechaInicio SIN cambios
      // (a diferencia de inscripción que calcula una fecha fin)
      it('should return fechaInicio unchanged', () => {
        store.establecerFechaInicio('2026-03-10');
        expect(store.fechaPagoVista()).toBe('2026-03-10');
      });

      it('should return empty string when inicio is empty', () => {
        store.establecerFechaInicio('');
        expect(store.fechaPagoVista()).toBe('');
      });
    });
  });
});
