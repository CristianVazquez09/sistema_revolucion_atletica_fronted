import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaModal } from './ra-modal';

@Component({
  standalone: true,
  imports: [RaModal],
  template: `
    <ra-modal titulo="Titulo de prueba" (cerrar)="cierres = cierres + 1">
      <p class="cuerpo">Contenido proyectado</p>
    </ra-modal>
  `,
})
class HostBasico {
  cierres = 0;
}

describe('RaModal', () => {
  let fixture: ComponentFixture<HostBasico>;
  let host: HostBasico;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBasico] });
    fixture = TestBed.createComponent(HostBasico);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function backdrop(): HTMLElement {
    return fixture.nativeElement.querySelector('.absolute.inset-0');
  }

  function panel(): HTMLElement {
    return fixture.nativeElement.querySelector('.rounded-2xl.bg-white');
  }

  it('proyecta el titulo y el contenido', () => {
    const h2: HTMLElement = fixture.nativeElement.querySelector('h2');
    const cuerpo: HTMLElement = fixture.nativeElement.querySelector('.cuerpo');
    expect(h2.textContent).toContain('Titulo de prueba');
    expect(cuerpo.textContent).toContain('Contenido proyectado');
  });

  it('click en el backdrop emite cerrar', () => {
    backdrop().click();
    expect(host.cierres).toBe(1);
  });

  it('click dentro del panel no emite cerrar', () => {
    panel().click();
    expect(host.cierres).toBe(0);
  });

  it('tecla Escape emite cerrar', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.cierres).toBe(1);
  });
});

@Component({
  standalone: true,
  imports: [RaModal],
  template: `
    <ra-modal
      titulo="Sin cierre al click afuera"
      [cerrarAlClickFuera]="false"
      (cerrar)="cierres = cierres + 1"
    >
      <p>Contenido</p>
    </ra-modal>
  `,
})
class HostSinCierreAlClickFuera {
  cierres = 0;
}

describe('RaModal con cerrarAlClickFuera=false', () => {
  it('click en el backdrop no emite cerrar', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostSinCierreAlClickFuera],
    }).createComponent(HostSinCierreAlClickFuera);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const backdrop: HTMLElement = fixture.nativeElement.querySelector('.absolute.inset-0');
    backdrop.click();
    expect(host.cierres).toBe(0);
  });
});

@Component({
  standalone: true,
  imports: [RaModal],
  template: `<ra-modal titulo="Angosto" anchoMax="max-w-xl"><p>Contenido</p></ra-modal>`,
})
class HostAnchoPersonalizado {}

describe('RaModal con anchoMax personalizado', () => {
  it('aplica la clase de anchoMax recibida en vez del default', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostAnchoPersonalizado],
    }).createComponent(HostAnchoPersonalizado);
    fixture.detectChanges();
    const contenedor: HTMLElement = fixture.nativeElement.querySelector('.relative.z-10');
    expect(contenedor.className).toContain('max-w-xl');
    expect(contenedor.className).not.toContain('max-w-2xl');
  });
});

describe('RaModal con anchoMax por defecto', () => {
  it('usa max-w-2xl cuando no se especifica anchoMax', () => {
    const fixture = TestBed.createComponent(HostBasico);
    fixture.detectChanges();
    const contenedor: HTMLElement = fixture.nativeElement.querySelector('.relative.z-10');
    expect(contenedor.className).toContain('max-w-2xl');
  });
});

@Component({
  standalone: true,
  imports: [RaModal],
  template: `
    <ra-modal titulo="Producto X">
      <p ra-modal-subtitulo class="subtitulo-a">Subtitulo linea 1</p>
      <p ra-modal-subtitulo class="subtitulo-b">Subtitulo linea 2</p>
      <div>Cuerpo</div>
    </ra-modal>
  `,
})
class HostConSubtitulo {}

describe('RaModal con [ra-modal-subtitulo]', () => {
  it('proyecta el contenido extra del header en el slot de subtitulo', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostConSubtitulo],
    }).createComponent(HostConSubtitulo);
    fixture.detectChanges();
    const subA: HTMLElement = fixture.nativeElement.querySelector('.subtitulo-a');
    const subB: HTMLElement = fixture.nativeElement.querySelector('.subtitulo-b');
    expect(subA.textContent).toContain('Subtitulo linea 1');
    expect(subB.textContent).toContain('Subtitulo linea 2');
  });
});
