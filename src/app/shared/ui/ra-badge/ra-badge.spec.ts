import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaBadge, RaBadgeVariante } from './ra-badge';

@Component({
  standalone: true,
  imports: [RaBadge],
  template: `<ra-badge [variante]="variante">{{ texto }}</ra-badge>`,
})
class HostBadge {
  variante: RaBadgeVariante = 'neutral';
  texto = 'Activo';
}

describe('RaBadge', () => {
  let fixture: ComponentFixture<HostBadge>;
  let host: HostBadge;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBadge] });
    fixture = TestBed.createComponent(HostBadge);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function span(): HTMLSpanElement {
    return fixture.nativeElement.querySelector('span');
  }

  it('proyecta el contenido', () => {
    expect(span().textContent?.trim()).toBe('Activo');
  });

  it('variante neutral por defecto', () => {
    expect(span().className).toContain('bg-gray-100');
  });

  it('siempre incluye gap-1 (espaciado entre icono y texto proyectados)', () => {
    expect(span().className).toContain('gap-1');
  });

  it('cambia de clases segun la variante', () => {
    host.variante = 'peligro';
    fixture.detectChanges();
    expect(span().className).toContain('bg-rose-100');
  });

  it('variante chip usa el token de marca', () => {
    host.variante = 'chip';
    fixture.detectChanges();
    expect(span().className).toContain('--color-ra-azul-fuerte');
  });

  it('variante exito usa verde esmeralda', () => {
    host.variante = 'exito';
    fixture.detectChanges();
    expect(span().className).toContain('bg-emerald-100');
  });

  it('variante advertencia usa ambar', () => {
    host.variante = 'advertencia';
    fixture.detectChanges();
    expect(span().className).toContain('bg-amber-100');
  });

  it('variante info usa indigo', () => {
    host.variante = 'info';
    fixture.detectChanges();
    expect(span().className).toContain('bg-indigo-100');
  });
});
