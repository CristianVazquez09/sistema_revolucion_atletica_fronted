import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaPaginador } from './ra-paginador';

@Component({
  standalone: true,
  imports: [RaPaginador],
  template: `
    <ra-paginador
      [paginaActual]="paginaActual"
      [totalPaginas]="totalPaginas"
      [totalElementos]="totalElementos"
      [tamanioPagina]="tamanioPagina"
      [tamaniosDisponibles]="tamaniosDisponibles"
      (irAPagina)="paginasRecibidas.push($event)"
      (cambiarTamanio)="tamaniosRecibidos.push($event)"
    ></ra-paginador>
  `,
})
class HostPaginador {
  paginaActual = 0;
  totalPaginas = 5;
  totalElementos = 42;
  tamanioPagina = 10;
  tamaniosDisponibles = [10, 25, 50];
  paginasRecibidas: number[] = [];
  tamaniosRecibidos: number[] = [];
}

describe('RaPaginador', () => {
  let fixture: ComponentFixture<HostPaginador>;
  let host: HostPaginador;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostPaginador] });
    fixture = TestBed.createComponent(HostPaginador);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function botonAnterior(): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLButtonElement).textContent?.trim() === 'Anterior',
    ) as HTMLButtonElement;
  }

  function botonSiguiente(): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLButtonElement).textContent?.trim() === 'Siguiente',
    ) as HTMLButtonElement;
  }

  function selectTrigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('ra-select button');
  }

  function opcionesFilas(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  it('(a) muestra "Página X de Y" y el conteo de registros correctamente', () => {
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Página');
    expect(texto).toContain('1');
    expect(texto).toContain('5');
    expect(texto).toContain('42 registros');
  });

  it('(b) boton "Anterior" deshabilitado en paginaActual=0, habilitado en otro caso, y emite irAPagina con paginaActual - 1', () => {
    expect(botonAnterior().disabled).toBeTrue();

    host.paginaActual = 2;
    fixture.detectChanges();
    expect(botonAnterior().disabled).toBeFalse();

    botonAnterior().click();
    fixture.detectChanges();
    expect(host.paginasRecibidas).toEqual([1]);
  });

  it('(c) boton "Siguiente" deshabilitado cuando paginaActual + 1 >= totalPaginas, y emite irAPagina con paginaActual + 1', () => {
    expect(botonSiguiente().disabled).toBeFalse();

    botonSiguiente().click();
    fixture.detectChanges();
    expect(host.paginasRecibidas).toEqual([1]);

    host.paginaActual = 4; // totalPaginas = 5, última página 0-based es 4
    fixture.detectChanges();
    expect(botonSiguiente().disabled).toBeTrue();
  });

  it('(d) cambiar el tamaño de página (via el ra-select interno) emite cambiarTamanio con el valor elegido', () => {
    selectTrigger().click();
    fixture.detectChanges();

    expect(opcionesFilas().length).toBe(3);
    opcionesFilas()[1].click(); // segunda opción de [10, 25, 50] -> 25
    fixture.detectChanges();

    expect(host.tamaniosRecibidos).toEqual([25]);
  });

  it('(e) tamaniosDisponibles custom se refleja en las opciones del select', () => {
    host.tamaniosDisponibles = [20, 40];
    fixture.detectChanges();

    selectTrigger().click();
    fixture.detectChanges();

    const etiquetas = opcionesFilas().map((b) => b.textContent?.trim());
    expect(etiquetas).toEqual(['20', '40']);
  });
});
