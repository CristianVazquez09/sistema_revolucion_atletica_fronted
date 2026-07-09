import { hoyISO, calcularFechaFin, calcularTotal, dateLocalFromISO } from './fechas-precios';

// NOTA: las aserciones de calcularFechaFin dependen de que el huso local no vaya
// adelante de UTC (México, UTC-6): la función usa toISOString() sobre fechas locales.
describe('fechas-precios', () => {
  describe('hoyISO', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 6, 8)); // 8 de julio de 2026, local
    });
    afterEach(() => jasmine.clock().uninstall());

    it('devuelve la fecha local de hoy como YYYY-MM-DD', () => {
      expect(hoyISO()).toBe('2026-07-08');
    });
  });

  describe('calcularFechaFin', () => {
    it('VISITA suma 1 día', () => {
      expect(calcularFechaFin('2026-03-10', 'VISITA')).toBe('2026-03-11');
    });

    it('alias legacy VISTA también suma 1 día', () => {
      expect(calcularFechaFin('2026-03-10', 'VISTA')).toBe('2026-03-11');
    });

    it('DIEZ_DIAS suma 10 días', () => {
      expect(calcularFechaFin('2026-03-10', 'DIEZ_DIAS')).toBe('2026-03-20');
    });

    it('QUINCE_DIAS suma 15 días', () => {
      expect(calcularFechaFin('2026-03-10', 'QUINCE_DIAS')).toBe('2026-03-25');
    });

    it('UNA_SEMANA suma 7 días', () => {
      expect(calcularFechaFin('2026-03-10', 'UNA_SEMANA')).toBe('2026-03-17');
    });

    it('DOS_SEMANAS suma 14 días', () => {
      expect(calcularFechaFin('2026-03-10', 'DOS_SEMANAS')).toBe('2026-03-24');
    });

    it('UN_MES suma 1 mes', () => {
      expect(calcularFechaFin('2026-03-10', 'UN_MES')).toBe('2026-04-10');
    });

    it('TRES_MESES suma 3 meses', () => {
      expect(calcularFechaFin('2026-03-10', 'TRES_MESES')).toBe('2026-06-10');
    });

    it('SEIS_MESES suma 6 meses', () => {
      expect(calcularFechaFin('2026-03-10', 'SEIS_MESES')).toBe('2026-09-10');
    });

    it('UN_ANIO suma 1 año', () => {
      expect(calcularFechaFin('2026-03-10', 'UN_ANIO')).toBe('2027-03-10');
    });

    it('mes con desbordamiento: 31 de enero + UN_MES desborda a marzo (comportamiento AS-IS de setMonth)', () => {
      expect(calcularFechaFin('2026-01-31', 'UN_MES')).toBe('2026-03-03');
    });

    it('tiempo desconocido cae al fallback de +1 mes', () => {
      expect(calcularFechaFin('2026-03-10', 'ALGO_RARO')).toBe('2026-04-10');
    });

    // Vigencia definida por el negocio (2026-07-09): los planes por visitas duran 2 meses,
    // como indica su etiqueta comercial "10/15 visitas (2 meses)".
    it('VISITA_10 suma 2 meses', () => {
      expect(calcularFechaFin('2026-03-10', 'VISITA_10')).toBe('2026-05-10');
    });

    it('VISITA_15 suma 2 meses', () => {
      expect(calcularFechaFin('2026-03-10', 'VISITA_15')).toBe('2026-05-10');
    });

  });

  describe('calcularFechaFin sin fecha de inicio', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 6, 8));
    });
    afterEach(() => jasmine.clock().uninstall());

    it('devuelve hoy', () => {
      expect(calcularFechaFin('', 'UN_MES')).toBe('2026-07-08');
    });
  });

  describe('calcularTotal', () => {
    it('sin descuento ni inscripción devuelve el precio', () => {
      expect(calcularTotal(500)).toBe(500);
    });

    it('resta el descuento', () => {
      expect(calcularTotal(500, 100)).toBe(400);
    });

    it('suma el costo de inscripción', () => {
      expect(calcularTotal(500, 0, 150)).toBe(650);
    });

    it('combina precio + inscripción - descuento', () => {
      expect(calcularTotal(500, 100, 150)).toBe(550);
    });

    it('nunca devuelve negativo', () => {
      expect(calcularTotal(100, 500)).toBe(0);
    });

    it('redondea a 2 decimales', () => {
      expect(calcularTotal(99.999)).toBe(100);
      expect(calcularTotal(10.126, 0.01)).toBe(10.12);
    });

    it('trata null/undefined/0 como 0', () => {
      expect(calcularTotal(0)).toBe(0);
      expect(calcularTotal(100, undefined, undefined)).toBe(100);
      expect(calcularTotal(100, null as any, null as any)).toBe(100);
    });
  });

  describe('dateLocalFromISO', () => {
    it('parsea YYYY-MM-DD a medianoche local', () => {
      const d = dateLocalFromISO('2026-05-01');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(4);
      expect(d.getDate()).toBe(1);
      expect(d.getHours()).toBe(0);
    });
  });
});
