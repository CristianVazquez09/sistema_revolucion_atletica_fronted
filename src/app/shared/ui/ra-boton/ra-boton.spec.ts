import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaBoton, RaBotonVariante } from './ra-boton';

@Component({
  standalone: true,
  imports: [RaBoton],
  template: `
    <ra-boton [variante]="variante" [deshabilitado]="deshabilitado" (click)="clicks = clicks + 1">
      Guardar
    </ra-boton>
  `,
})
class HostBoton {
  variante: RaBotonVariante = 'primario';
  deshabilitado = false;
  clicks = 0;
}

describe('RaBoton', () => {
  let fixture: ComponentFixture<HostBoton>;
  let host: HostBoton;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBoton] });
    fixture = TestBed.createComponent(HostBoton);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function boton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  it('proyecta el contenido', () => {
    expect(boton().textContent?.trim()).toBe('Guardar');
  });

  it('variante primario por defecto', () => {
    expect(boton().className).toContain('bg-red-600');
  });

  it('cambia de clases segun la variante', () => {
    host.variante = 'exito';
    fixture.detectChanges();
    expect(boton().className).toContain('bg-emerald-600');
  });

  it('el click en el boton interno burbujea al host', () => {
    boton().click();
    expect(host.clicks).toBe(1);
  });

  it('respeta deshabilitado', () => {
    host.deshabilitado = true;
    fixture.detectChanges();
    expect(boton().disabled).toBeTrue();
  });

  it('variante icono-peligro es circular', () => {
    host.variante = 'icono-peligro';
    fixture.detectChanges();
    expect(boton().className).toContain('rounded-full');
    expect(boton().className).toContain('w-8');
    expect(boton().className).toContain('h-8');
  });
});
