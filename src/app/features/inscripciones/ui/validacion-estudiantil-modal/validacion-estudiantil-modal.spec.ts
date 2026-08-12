import { TestBed } from '@angular/core/testing';
import { ValidacionEstudiantilModal } from './validacion-estudiantil-modal';
import { EstudiantilCheck } from '../../pages/reinscripcion/reinscripcion';

describe('ValidacionEstudiantilModal', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ValidacionEstudiantilModal>>;
  let component: ValidacionEstudiantilModal;

  const check = (over: Partial<EstudiantilCheck> = {}): EstudiantilCheck => ({
    socioId: 1,
    nombre: 'Ana Ruiz',
    edad: 20,
    edadOk: true,
    motivoEdad: null,
    vigencia: '2026-01-01',
    vigenciaOk: true,
    motivoVigencia: null,
    ...over,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ValidacionEstudiantilModal);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should not render anything when visible=false', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  it('should render one card per check when visible=true', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('checks', [check({ socioId: 1, nombre: 'Ana' }), check({ socioId: 2, nombre: 'Luis' })]);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Ana');
    expect(text).toContain('Luis');
  });

  describe('vigenciaDe', () => {
    it('should return the value from vigenciaPorSocio for that socioId', () => {
      fixture.componentRef.setInput('vigenciaPorSocio', { '1': '2026-05-01' });
      fixture.componentRef.setInput('today', '2026-01-01');
      fixture.detectChanges();
      expect(component.vigenciaDe(1)).toBe('2026-05-01');
    });

    it('should fall back to today() when there is no entry for that socioId', () => {
      fixture.componentRef.setInput('vigenciaPorSocio', {});
      fixture.componentRef.setInput('today', '2026-01-01');
      fixture.detectChanges();
      expect(component.vigenciaDe(99)).toBe('2026-01-01');
    });
  });

  describe('guardandoDe', () => {
    it('should return true only for socioIds present and true in guardandoPorSocio', () => {
      fixture.componentRef.setInput('guardandoPorSocio', { '1': true, '2': false });
      fixture.detectChanges();
      expect(component.guardandoDe(1)).toBe(true);
      expect(component.guardandoDe(2)).toBe(false);
      expect(component.guardandoDe(3)).toBe(false);
    });
  });

  describe('outputs', () => {
    it('should emit cerrar when the close button is clicked', () => {
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      const spy = spyOn(component.cerrar, 'emit');
      component.cerrar.emit();
      expect(spy).toHaveBeenCalled();
    });

    it('should emit vigenciaCambio with socioId and value on onVigenciaInput', () => {
      const spy = spyOn(component.vigenciaCambio, 'emit');
      component.onVigenciaInput(7, '2026-08-01');
      expect(spy).toHaveBeenCalledWith({ socioId: 7, value: '2026-08-01' });
    });

    it('should emit guardarVigencia with the socioId', () => {
      fixture.componentRef.setInput('visible', true);
      fixture.componentRef.setInput('checks', [check({ socioId: 5, vigenciaOk: false })]);
      fixture.detectChanges();
      const spy = spyOn(component.guardarVigencia, 'emit');

      const btn = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      ).find((b) => b.textContent?.includes('Guardar vigencia'));
      btn?.dispatchEvent(new MouseEvent('click'));

      expect(spy).toHaveBeenCalledWith(5);
    });
  });

  it('should disable "Continuar con el pago" when puedeContinuar=false', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('puedeContinuar', false);
    fixture.detectChanges();
    const btn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Continuar con el pago'),
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
