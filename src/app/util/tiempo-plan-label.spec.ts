import { TiempoPlanLabelPipe } from './tiempo-plan-label';
import { TiempoPlan } from './enums/tiempo-plan';

describe('TiempoPlanLabelPipe', () => {
  let pipe: TiempoPlanLabelPipe;

  beforeEach(() => {
    pipe = new TiempoPlanLabelPipe();
  });

  it('mapea las claves base del enum', () => {
    expect(pipe.transform(TiempoPlan.VISITA)).toBe('Visita');
    expect(pipe.transform(TiempoPlan.DIEZ_DIAS)).toBe('10 días');
    expect(pipe.transform(TiempoPlan.QUINCE_DIAS)).toBe('15 días');
    expect(pipe.transform(TiempoPlan.UNA_SEMANA)).toBe('1 semana');
    expect(pipe.transform(TiempoPlan.DOS_SEMANAS)).toBe('2 semanas');
    expect(pipe.transform(TiempoPlan.MENSUAL)).toBe('1 mes');       // enum MENSUAL = 'UN_MES'
    expect(pipe.transform(TiempoPlan.TRIMESTRAL)).toBe('3 meses');  // enum TRIMESTRAL = 'TRES_MESES'
    expect(pipe.transform(TiempoPlan.SEMESTRAL)).toBe('6 meses');
    expect(pipe.transform(TiempoPlan.ANUAL)).toBe('1 año');
  });

  it('mapea los planes por visitas', () => {
    expect(pipe.transform(TiempoPlan.VISITA_10)).toBe('10 visitas (2 meses)');
    expect(pipe.transform(TiempoPlan.VISITA_15)).toBe('15 visitas (2 meses)');
  });

  it('mapea alias legacy y strings "bonitos"', () => {
    expect(pipe.transform('VISTA')).toBe('Visita');
    expect(pipe.transform('MENSUAL')).toBe('Mensual');
    expect(pipe.transform('TRIMESTRAL')).toBe('Trimestral');
    expect(pipe.transform('SEMESTRAL')).toBe('Semestral');
    expect(pipe.transform('ANUAL')).toBe('Anual');
  });

  it('es insensible a mayúsculas', () => {
    expect(pipe.transform('un_mes')).toBe('1 mes');
  });

  it('claves desconocidas caen al fallback Title Case', () => {
    expect(pipe.transform('PLAN_ESPECIAL')).toBe('Plan Especial');
  });

  it('null y undefined devuelven cadena vacía', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
