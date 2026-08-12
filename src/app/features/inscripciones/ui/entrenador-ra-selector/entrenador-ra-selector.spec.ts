import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EntrenadorRaSelector } from './entrenador-ra-selector';
import { EntrenadorService } from '../../../asesorias/data/entrenador-service';

describe('EntrenadorRaSelector', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<EntrenadorRaSelector>>;
  let component: EntrenadorRaSelector;
  let entrenadorSrv: jasmine.SpyObj<EntrenadorService>;

  function setup(listaRespuesta: any[] = []) {
    entrenadorSrv = jasmine.createSpyObj<EntrenadorService>('EntrenadorService', ['buscarTodos']);
    entrenadorSrv.buscarTodos.and.returnValue(of(listaRespuesta) as any);

    TestBed.configureTestingModule({
      providers: [{ provide: EntrenadorService, useValue: entrenadorSrv }],
    });
    fixture = TestBed.createComponent(EntrenadorRaSelector);
    component = fixture.componentInstance;
  }

  it('should be created', () => {
    setup([]);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load active entrenadores on init and emit entrenadoresCargados', () => {
    setup([
      { idEntrenador: 1, nombre: 'Ana', apellido: 'Ruiz', activo: true },
      { idEntrenador: 2, nombre: 'Luis', apellido: 'Diaz', activo: false },
    ]);
    const emitSpy = spyOn(component.entrenadoresCargados, 'emit');

    fixture.detectChanges();

    expect(component.entrenadoresSig().length).toBe(1);
    expect(component.entrenadoresSig()[0].idEntrenador).toBe(1);
    expect(emitSpy).toHaveBeenCalledWith([jasmine.objectContaining({ idEntrenador: 1 })]);
    expect(component.cargandoSig()).toBe(false);
  });

  it('should dedupe entrenadores with the same idEntrenador', () => {
    setup([
      { idEntrenador: 1, nombre: 'Ana', apellido: 'Ruiz', activo: true },
      { idEntrenador: 1, nombre: 'Ana', apellido: 'Ruiz', activo: true },
    ]);

    fixture.detectChanges();

    expect(component.entrenadoresSig().length).toBe(1);
  });

  it('should filter out entrenadores without a valid idEntrenador', () => {
    setup([{ idEntrenador: 0, nombre: 'Sin ID', apellido: '', activo: true }]);

    fixture.detectChanges();

    expect(component.entrenadoresSig().length).toBe(0);
  });

  it('should set cargandoSig false on error', () => {
    setup([]);
    entrenadorSrv.buscarTodos.and.returnValue(throwError(() => new Error('boom')) as any);

    fixture.detectChanges();

    expect(component.cargandoSig()).toBe(false);
  });

  it('onChange should emit a positive numeric id', () => {
    setup([]);
    fixture.detectChanges();
    const emitSpy = spyOn(component.entrenadorIdChange, 'emit');

    component.onChange('5');

    expect(emitSpy).toHaveBeenCalledWith(5);
  });

  it('onChange should emit null for empty/zero/non-numeric value', () => {
    setup([]);
    fixture.detectChanges();
    const emitSpy = spyOn(component.entrenadorIdChange, 'emit');

    component.onChange('');
    component.onChange('0');
    component.onChange('abc');

    expect(emitSpy.calls.allArgs()).toEqual([[null], [null], [null]]);
  });
});
