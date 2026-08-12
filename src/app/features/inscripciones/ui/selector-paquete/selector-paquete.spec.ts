import { TestBed } from '@angular/core/testing';
import { SelectorPaquete } from './selector-paquete';
import { PaqueteData } from '../../../../shared/models/paquete-data';
import { TiempoPlan } from '../../../../shared/util/enums/tiempo-plan';

describe('SelectorPaquete', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<SelectorPaquete>>;
  let component: SelectorPaquete;

  const paquete = (over: Partial<PaqueteData> = {}): PaqueteData => ({
    idPaquete: 1,
    nombre: 'Mensualidad',
    precio: 500,
    tiempo: TiempoPlan.MENSUAL,
    costoInscripcion: 0,
    activo: true,
    ...over,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(SelectorPaquete);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('modalidadTexto', () => {
    it('should map DUO/TRIO/SQUAD/INDIVIDUAL to their display labels', () => {
      expect(component.modalidadTexto('DUO')).toBe('Dúo (2)');
      expect(component.modalidadTexto('TRIO')).toBe('Trío (3)');
      expect(component.modalidadTexto('SQUAD')).toBe('Squad (5)');
      expect(component.modalidadTexto('INDIVIDUAL')).toBe('Individual (1)');
    });

    it('should default to Individual for unknown/undefined modalidad', () => {
      expect(component.modalidadTexto(undefined)).toBe('Individual (1)');
      expect(component.modalidadTexto('OTRA')).toBe('Individual (1)');
    });
  });

  describe('outputs', () => {
    it('onInput should emit busquedaChange with the typed value', () => {
      fixture.detectChanges();
      const spy = spyOn(component.busquedaChange, 'emit');
      component.onInput('mensual');
      expect(spy).toHaveBeenCalledWith('mensual');
    });

    it('onSeleccionar should stop propagation and emit seleccionar with the package', () => {
      fixture.detectChanges();
      const p = paquete();
      const evt = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);
      const spy = spyOn(component.seleccionar, 'emit');

      component.onSeleccionar(p, evt);

      expect(evt.stopPropagation).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(p);
    });

    it('onLimpiar should emit limpiar with the mouse event', () => {
      fixture.detectChanges();
      const evt = new MouseEvent('click');
      const spy = spyOn(component.limpiar, 'emit');

      component.onLimpiar(evt);

      expect(spy).toHaveBeenCalledWith(evt);
    });
  });

  describe('template rendering', () => {
    function setInputs(over: Partial<Record<string, unknown>>) {
      fixture.componentRef.setInput('paquetes', over['paquetes'] ?? []);
      fixture.componentRef.setInput('busqueda', over['busqueda'] ?? '');
      fixture.componentRef.setInput('abierto', over['abierto'] ?? false);
      fixture.componentRef.setInput('bloqueado', over['bloqueado'] ?? false);
      fixture.componentRef.setInput('cargando', over['cargando'] ?? false);
      fixture.componentRef.setInput('buscando', over['buscando'] ?? false);
      fixture.componentRef.setInput('errorBusqueda', over['errorBusqueda'] ?? null);
      fixture.componentRef.setInput('mostrarDetalle', over['mostrarDetalle'] ?? false);
      fixture.detectChanges();
    }

    it('should show "Buscando…" when buscando=true and abierto=true', () => {
      setInputs({ abierto: true, buscando: true });
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Buscando…');
    });

    it('should show the remote search error when present', () => {
      setInputs({ abierto: true, errorBusqueda: 'fallo de red' });
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('fallo de red');
    });

    it('should show "Sin resultados." when the list is empty', () => {
      setInputs({ abierto: true, paquetes: [] });
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Sin resultados.');
    });

    it('should render one button per paquete with nombre and precio', () => {
      setInputs({ abierto: true, paquetes: [paquete({ idPaquete: 1, nombre: 'A' }), paquete({ idPaquete: 2, nombre: 'B', precio: 300 })] });
      const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button[type="button"]');
      // primer botón es el de "Limpiar" solo si busqueda() tiene texto; aquí no, así que son solo los 2 de la lista
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('A');
      expect(text).toContain('B');
      expect(text).toContain('$300.00');
      expect(buttons.length).toBe(2);
    });

    it('should show modalidad + Estudiantil only when mostrarDetalle=true', () => {
      setInputs({
        abierto: true,
        mostrarDetalle: true,
        paquetes: [paquete({ modalidad: 'DUO' as any, estudiantil: true })],
      });
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Dúo (2)');
      expect(text).toContain('Estudiantil');
    });

    it('should NOT show modalidad/estudiantil detail when mostrarDetalle=false', () => {
      setInputs({
        abierto: true,
        mostrarDetalle: false,
        paquetes: [paquete({ modalidad: 'DUO' as any, estudiantil: true })],
      });
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).not.toContain('Dúo (2)');
      expect(text).not.toContain('Estudiantil');
    });

    it('should NOT show the clear button when busqueda is empty', () => {
      setInputs({ busqueda: '' });
      const clearBtn = (fixture.nativeElement as HTMLElement).querySelector('button[title="Limpiar"]');
      expect(clearBtn).toBeNull();
    });

    it('should show the clear button when busqueda has text and not bloqueado/cargando', () => {
      setInputs({ busqueda: 'algo' });
      const clearBtn = (fixture.nativeElement as HTMLElement).querySelector('button[title="Limpiar"]');
      expect(clearBtn).not.toBeNull();
    });

    it('should NOT show the dropdown when abierto=false', () => {
      setInputs({ abierto: false, paquetes: [paquete()] });
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).not.toContain('Mensualidad');
    });

    it('should disable the input when bloqueado or cargando', () => {
      setInputs({ bloqueado: true });
      const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });
});
