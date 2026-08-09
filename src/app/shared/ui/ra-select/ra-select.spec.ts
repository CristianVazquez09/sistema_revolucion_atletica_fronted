import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RaSelect, RaSelectOpcion } from './ra-select';

const OPCIONES: RaSelectOpcion<number>[] = [
  { valor: 1, etiqueta: 'Uno' },
  { valor: 2, etiqueta: 'Dos' },
  { valor: 3, etiqueta: 'Tres' },
];

@Component({
  standalone: true,
  imports: [RaSelect],
  template: `
    <ra-select
      [opciones]="opciones"
      [placeholder]="placeholder"
      [deshabilitado]="deshabilitado"
      (click)="clicksExternos = clicksExternos + 1"
    ></ra-select>
    <div id="afuera">afuera</div>
  `,
})
class HostSelect {
  opciones = OPCIONES;
  placeholder = 'Selecciona…';
  deshabilitado = false;
  clicksExternos = 0;
}

describe('RaSelect', () => {
  let fixture: ComponentFixture<HostSelect>;
  let host: HostSelect;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostSelect] });
    fixture = TestBed.createComponent(HostSelect);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('ra-select button');
  }

  function raSelectDebugElement() {
    return fixture.debugElement.query((de) => de.name === 'ra-select');
  }

  function raSelectInstance(): RaSelect<number> {
    return raSelectDebugElement().componentInstance as RaSelect<number>;
  }

  function panel(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="listbox"]');
  }

  function opcionesFilas(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  function keydown(key: string): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    raSelectDebugElement().nativeElement.dispatchEvent(event);
    fixture.detectChanges();
  }

  it('(a) writeValue refleja la etiqueta correcta en el control cerrado', () => {
    raSelectInstance().writeValue(2);
    fixture.detectChanges();
    expect(trigger().textContent).toContain('Dos');
  });

  it('(b) sin valor muestra el placeholder', () => {
    expect(trigger().textContent).toContain('Selecciona…');
  });

  it('(c) click abre el panel y click de nuevo lo cierra', () => {
    expect(panel()).toBeNull();

    trigger().click();
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    trigger().click();
    fixture.detectChanges();
    expect(panel()).toBeNull();
  });

  it('(d) click en una opcion llama onChange con el valor correcto y cierra el panel', () => {
    let valorRecibido: number | null | undefined;
    raSelectInstance().registerOnChange((v) => (valorRecibido = v));

    trigger().click();
    fixture.detectChanges();
    opcionesFilas()[1].click();
    fixture.detectChanges();

    expect(valorRecibido).toBe(2);
    expect(panel()).toBeNull();
    expect(trigger().textContent).toContain('Dos');
  });

  it('(e) click fuera del componente cierra el panel', () => {
    trigger().click();
    fixture.detectChanges();
    expect(panel()).not.toBeNull();

    const afuera: HTMLElement = fixture.nativeElement.querySelector('#afuera');
    afuera.click();
    fixture.detectChanges();

    expect(panel()).toBeNull();
  });

  it('(f) ArrowDown/ArrowUp mueven el indice resaltado con limites correctos (sin wrap)', () => {
    trigger().click();
    fixture.detectChanges();
    const instancia = raSelectInstance();

    // Arranca sin nada resaltado (-1): ningún valor seleccionado aún.
    expect((instancia as any).resaltado()).toBe(-1);

    keydown('ArrowDown');
    expect((instancia as any).resaltado()).toBe(0);
    keydown('ArrowDown');
    expect((instancia as any).resaltado()).toBe(1);
    keydown('ArrowDown');
    expect((instancia as any).resaltado()).toBe(2);
    // Ya en el último (índice 2 de 3 opciones): no debe pasar de ahí.
    keydown('ArrowDown');
    expect((instancia as any).resaltado()).toBe(2);

    keydown('ArrowUp');
    expect((instancia as any).resaltado()).toBe(1);
    keydown('ArrowUp');
    expect((instancia as any).resaltado()).toBe(0);
    // Ya en el primero (índice 0): no debe bajar de ahí.
    keydown('ArrowUp');
    expect((instancia as any).resaltado()).toBe(0);
  });

  it('(g) Enter con el panel abierto selecciona la opcion resaltada', () => {
    let valorRecibido: number | null | undefined;
    raSelectInstance().registerOnChange((v) => (valorRecibido = v));

    trigger().click();
    fixture.detectChanges();
    keydown('ArrowDown');
    keydown('ArrowDown');
    keydown('Enter');

    expect(valorRecibido).toBe(2);
    expect(panel()).toBeNull();
  });

  it('(h) Escape cierra sin seleccionar', () => {
    let valorRecibido: number | null | undefined;
    raSelectInstance().registerOnChange((v) => (valorRecibido = v));

    trigger().click();
    fixture.detectChanges();
    keydown('ArrowDown');
    keydown('Escape');

    expect(panel()).toBeNull();
    expect(valorRecibido).toBeUndefined();
  });

  it('ArrowDown desde cerrado abre el panel y resalta la primera opcion', () => {
    expect(panel()).toBeNull();
    keydown('ArrowDown');
    expect(panel()).not.toBeNull();
    expect((raSelectInstance() as any).resaltado()).toBe(0);
  });

  it('ArrowUp desde cerrado abre el panel y resalta la ULTIMA opcion (no la primera)', () => {
    expect(panel()).toBeNull();
    keydown('ArrowUp');
    expect(panel()).not.toBeNull();
    // 3 opciones -> ultimo indice es 2. Si cayera en 0 se comportaria igual
    // que ArrowDown, que es justo el bug que se corrigio.
    expect((raSelectInstance() as any).resaltado()).toBe(2);
  });

  it('el blur del control dispara onTouched (ej. Tab sin abrir el panel)', () => {
    let tocado = false;
    raSelectInstance().registerOnTouched(() => (tocado = true));

    trigger().dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(tocado).toBeTrue();
  });

  it('Escape tambien dispara onTouched al cerrar', () => {
    let tocado = false;
    raSelectInstance().registerOnTouched(() => (tocado = true));

    trigger().click();
    fixture.detectChanges();
    keydown('Escape');

    expect(tocado).toBeTrue();
  });

  it('(i) deshabilitado=true bloquea apertura por click Y por teclado', () => {
    host.deshabilitado = true;
    fixture.detectChanges();

    expect(trigger().disabled).toBeTrue();

    trigger().click();
    fixture.detectChanges();
    expect(panel()).toBeNull();

    keydown('Enter');
    expect(panel()).toBeNull();
    keydown('ArrowDown');
    expect(panel()).toBeNull();
  });

  it('tamano por defecto (normal) usa las clases de input-filled', () => {
    expect(trigger().className).toContain('input-filled');
  });
});

@Component({
  standalone: true,
  imports: [RaSelect],
  template: `<ra-select [opciones]="opciones"></ra-select>`,
})
class HostSelectVacio {
  opciones: RaSelectOpcion<number>[] = [];
}

describe('RaSelect sin opciones', () => {
  it('ArrowDown/ArrowUp desde cerrado no dejan un indice invalido (se quedan en -1)', () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostSelectVacio] })
      .createComponent(HostSelectVacio);
    fixture.detectChanges();
    const instancia = fixture.debugElement.query((de) => de.name === 'ra-select')
      .componentInstance as RaSelect<number>;

    const dispatch = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      fixture.debugElement.query((de) => de.name === 'ra-select').nativeElement.dispatchEvent(event);
      fixture.detectChanges();
    };

    dispatch('ArrowDown');
    expect((instancia as any).resaltado()).toBe(-1);

    dispatch('Enter');
    // No debe llamar seleccionar() con una opcion inexistente (no crashea,
    // no queda el panel en un estado raro).
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).not.toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [RaSelect],
  template: `<ra-select tamano="compacto" [opciones]="opciones"></ra-select>`,
})
class HostSelectCompacto {
  opciones = OPCIONES;
}

describe('RaSelect con tamano="compacto"', () => {
  it('usa las clases compactas (h-8) en vez de input-filled', () => {
    const fixture = TestBed.configureTestingModule({ imports: [HostSelectCompacto] })
      .createComponent(HostSelectCompacto);
    fixture.detectChanges();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(trigger.className).toContain('h-8');
    expect(trigger.className).not.toContain('input-filled');
  });
});

@Component({
  standalone: true,
  imports: [RaSelect, ReactiveFormsModule],
  template: `<form [formGroup]="form"><ra-select formControlName="x" [opciones]="opciones"></ra-select></form>`,
})
class HostReactiveForms {
  opciones = OPCIONES;
  form = new FormGroup({
    x: new FormControl<number | null>(null),
  });
}

describe('RaSelect - integracion con Reactive Forms', () => {
  let fixture: ComponentFixture<HostReactiveForms>;
  let host: HostReactiveForms;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostReactiveForms] });
    fixture = TestBed.createComponent(HostReactiveForms);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('ra-select button');
  }

  function opcionesFilas(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  it('(j) form.controls.x.setValue actualiza lo mostrado (via writeValue)', () => {
    host.form.controls.x.setValue(3);
    fixture.detectChanges();
    expect(trigger().textContent).toContain('Tres');
  });

  it('(j) seleccionar una opcion actualiza form.controls.x.value', () => {
    trigger().click();
    fixture.detectChanges();
    opcionesFilas()[0].click();
    fixture.detectChanges();

    expect(host.form.controls.x.value).toBe(1);
  });

  it('(j) form.controls.x.disable() deshabilita el control (via setDisabledState)', () => {
    expect(trigger().disabled).toBeFalse();

    host.form.controls.x.disable();
    fixture.detectChanges();

    expect(trigger().disabled).toBeTrue();
  });
});
