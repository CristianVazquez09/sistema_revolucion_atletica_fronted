import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RaBuscador } from './ra-buscador';

@Component({
  standalone: true,
  imports: [RaBuscador],
  template: `<ra-buscador [debounceMs]="50" (buscar)="terminos.push($event)"></ra-buscador>`,
})
class HostBuscador {
  terminos: string[] = [];
}

describe('RaBuscador', () => {
  let fixture: ComponentFixture<HostBuscador>;
  let host: HostBuscador;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBuscador] });
    fixture = TestBed.createComponent(HostBuscador);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  function escribir(valor: string): void {
    const el = input();
    el.value = valor;
    el.dispatchEvent(new Event('input'));
  }

  it('no emite antes de que pase el debounce', fakeAsync(() => {
    escribir('ana');
    tick(10);
    expect(host.terminos).toEqual([]);
  }));

  it('emite el termino recortado tras el debounce', fakeAsync(() => {
    escribir('  ana  ');
    tick(60);
    expect(host.terminos).toEqual(['ana']);
  }));

  it('no emite dos veces el mismo termino seguido (distinctUntilChanged)', fakeAsync(() => {
    escribir('ana');
    tick(60);
    escribir('ana');
    tick(60);
    expect(host.terminos).toEqual(['ana']);
  }));

  it('el boton limpiar vacia el campo y emite cadena vacia', fakeAsync(() => {
    escribir('ana');
    tick(60);
    fixture.detectChanges();
    const limpiarBtn = fixture.nativeElement.querySelector('button');
    limpiarBtn.click();
    tick(60);
    // TestBed no auto-detecta cambios: el signal terminoActual() ya se puso
    // en '' de forma sincrona en limpiar(), pero el binding [value] del
    // input nativo no se repinta hasta el proximo ciclo de deteccion.
    fixture.detectChanges();
    expect(input().value).toBe('');
    expect(host.terminos).toEqual(['ana', '']);
  }));

  it('el boton limpiar no aparece si mostrarLimpiar es false', () => {
    fixture.componentInstance.terminos = [];
    (fixture.debugElement.children[0].componentInstance as RaBuscador);
    // Verificado por ausencia de termino inicial: sin texto, no hay boton.
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [RaBuscador],
  template: `<ra-buscador [debounceMs]="50" [mostrarLimpiar]="false"></ra-buscador>`,
})
class HostSinBotonLimpiar {}

describe('RaBuscador con mostrarLimpiar=false', () => {
  it('no muestra el boton limpiar aunque haya un termino escrito', fakeAsync(() => {
    const fixture = TestBed.configureTestingModule({ imports: [HostSinBotonLimpiar] })
      .createComponent(HostSinBotonLimpiar);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'ana';
    input.dispatchEvent(new Event('input'));
    tick(60);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  }));
});

@Component({
  standalone: true,
  imports: [RaBuscador],
  template: `<ra-buscador [debounceMs]="50" [valor]="externo" (buscar)="terminos.push($event)"></ra-buscador>`,
})
class HostBuscadorControlado {
  externo: string | null = null;
  terminos: string[] = [];
}

describe('RaBuscador con valor (controlado desde el padre)', () => {
  let fixture: ComponentFixture<HostBuscadorControlado>;
  let host: HostBuscadorControlado;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBuscadorControlado] });
    fixture = TestBed.createComponent(HostBuscadorControlado);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  it('sin valor (null) el input queda vacio, sin control externo', () => {
    expect(input().value).toBe('');
  });

  it('al cambiar valor desde el padre, el input se actualiza', () => {
    host.externo = 'preseleccionado';
    fixture.detectChanges();
    expect(input().value).toBe('preseleccionado');
  });

  it('el padre puede limpiar el texto mostrado (ej. boton "Limpiar filtros" propio)', fakeAsync(() => {
    host.externo = 'ana';
    fixture.detectChanges();
    expect(input().value).toBe('ana');

    host.externo = '';
    fixture.detectChanges();
    expect(input().value).toBe('');
  }));
});

@Component({
  standalone: true,
  imports: [RaBuscador],
  template: `<ra-buscador ancho="w-full"></ra-buscador>`,
})
class HostAnchoPersonalizado {}

describe('RaBuscador con ancho personalizado', () => {
  it('aplica la clase de ancho recibida en vez del default fijo', () => {
    const fixture = TestBed.createComponent(HostAnchoPersonalizado);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.className).toContain('w-full');
    expect(input.className).not.toContain('w-[240px]');
  });
});

describe('RaBuscador con ancho por defecto', () => {
  it('usa w-[240px] cuando no se especifica ancho', () => {
    const fixture = TestBed.createComponent(HostBuscador);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.className).toContain('w-[240px]');
  });
});
