import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaCampo } from './ra-campo';

@Component({
  standalone: true,
  imports: [RaCampo],
  template: `
    <ra-campo [etiqueta]="etiqueta" [requerido]="requerido" [error]="error">
      <input class="input-filled" [value]="valor" />
    </ra-campo>
  `,
})
class HostCampo {
  etiqueta = 'Nombre';
  requerido = false;
  error: string | null = null;
  valor = '';
}

describe('RaCampo', () => {
  let fixture: ComponentFixture<HostCampo>;
  let host: HostCampo;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostCampo] });
    fixture = TestBed.createComponent(HostCampo);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra la etiqueta', () => {
    expect(fixture.nativeElement.querySelector('label').textContent).toContain('Nombre');
  });

  it('proyecta el control real (input sigue siendo el mismo elemento)', () => {
    const input = fixture.nativeElement.querySelector('input.input-filled');
    expect(input).not.toBeNull();
  });

  it('sin requerido no muestra asterisco', () => {
    expect(fixture.nativeElement.querySelector('label').textContent).not.toContain('*');
  });

  it('con requerido muestra asterisco', () => {
    host.requerido = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('label').textContent).toContain('*');
  });

  it('sin error no muestra el parrafo de error', () => {
    expect(fixture.nativeElement.querySelector('p')).toBeNull();
  });

  it('con error lo muestra', () => {
    host.error = 'Campo obligatorio';
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('p');
    expect(p?.textContent?.trim()).toBe('Campo obligatorio');
  });

  it('sin etiqueta no renderiza el label', () => {
    host.etiqueta = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('label')).toBeNull();
  });
});
