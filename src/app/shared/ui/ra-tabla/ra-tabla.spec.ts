import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaTabla } from './ra-tabla';

@Component({
  standalone: true,
  imports: [RaTabla],
  template: `
    <ra-tabla ancho="min-w-[400px]">
      <thead ra-tabla-head>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tr>
        <td class="fila-real">fila real</td>
      </tr>
    </ra-tabla>
  `,
})
class HostBasico {}

describe('RaTabla', () => {
  it('proyecta el thead (via [ra-tabla-head]) y las filas reales cuando no hay estado especial', () => {
    const fixture: ComponentFixture<HostBasico> = TestBed.configureTestingModule({
      imports: [HostBasico],
    }).createComponent(HostBasico);
    fixture.detectChanges();

    const thead: HTMLElement = fixture.nativeElement.querySelector('thead');
    const th: HTMLElement = fixture.nativeElement.querySelector('th');
    const filaReal: HTMLElement = fixture.nativeElement.querySelector('.fila-real');

    expect(thead).not.toBeNull();
    expect(th.textContent).toContain('Columna');
    expect(filaReal).not.toBeNull();
    expect(filaReal.textContent).toContain('fila real');
  });

  it('aplica la clase de ancho recibida en el <table>', () => {
    const fixture: ComponentFixture<HostBasico> = TestBed.configureTestingModule({
      imports: [HostBasico],
    }).createComponent(HostBasico);
    fixture.detectChanges();

    const table: HTMLElement = fixture.nativeElement.querySelector('table');
    expect(table.className).toContain('min-w-[400px]');
  });
});

@Component({
  standalone: true,
  imports: [RaTabla],
  template: `
    <ra-tabla ancho="min-w-[400px]">
      <colgroup ra-tabla-colgroup>
        <col class="w-[30%]" />
        <col class="w-[70%]" />
      </colgroup>
      <thead ra-tabla-head>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tr>
        <td class="fila-real">fila real</td>
      </tr>
    </ra-tabla>
  `,
})
class HostConColgroup {}

describe('RaTabla con colgroup', () => {
  it('proyecta el colgroup como hijo directo de <table>, ANTES del thead (no anidado adentro)', () => {
    const fixture: ComponentFixture<HostConColgroup> = TestBed.configureTestingModule({
      imports: [HostConColgroup],
    }).createComponent(HostConColgroup);
    fixture.detectChanges();

    const table: HTMLTableElement = fixture.nativeElement.querySelector('table');
    const colgroup = table.querySelector('colgroup');

    expect(colgroup).not.toBeNull();
    // Hijo DIRECTO de <table> — si quedara anidado dentro del <thead>
    // proyectado, el navegador lo trataría como mal ubicado y los anchos
    // de columna dejarían de aplicar (sin ningún error visible).
    expect(colgroup!.parentElement).toBe(table);
    // Antes del thead, como exige la especificación CSS de tablas.
    expect(colgroup!.nextElementSibling?.tagName.toLowerCase()).toBe('thead');
    expect(colgroup!.querySelectorAll('col').length).toBe(2);
  });
});

@Component({
  standalone: true,
  imports: [RaTabla],
  template: `
    <ra-tabla [cargando]="true">
      <thead ra-tabla-head>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tr>
        <td class="fila-real">fila real</td>
      </tr>
    </ra-tabla>
  `,
})
class HostCargando {}

describe('RaTabla con cargando=true', () => {
  let fixture: ComponentFixture<HostCargando>;

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({ imports: [HostCargando] }).createComponent(
      HostCargando,
    );
    fixture.detectChanges();
  });

  it('muestra el mensaje de cargando por defecto', () => {
    expect(fixture.nativeElement.textContent).toContain('Cargando…');
  });

  it('no proyecta las filas reales', () => {
    expect(fixture.nativeElement.querySelector('.fila-real')).toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [RaTabla],
  template: `
    <ra-tabla [error]="'Algo salió mal'" [vacio]="true">
      <thead ra-tabla-head>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tr>
        <td class="fila-real">fila real</td>
      </tr>
    </ra-tabla>
  `,
})
class HostErrorYVacio {}

describe('RaTabla con error (y vacio=true a la vez)', () => {
  let fixture: ComponentFixture<HostErrorYVacio>;

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({ imports: [HostErrorYVacio] }).createComponent(
      HostErrorYVacio,
    );
    fixture.detectChanges();
  });

  it('muestra el mensaje de error en rojo', () => {
    const celdaError: HTMLElement = fixture.nativeElement.querySelector('td.text-red-600');
    expect(celdaError).not.toBeNull();
    expect(celdaError.textContent).toContain('Algo salió mal');
  });

  it('tiene prioridad sobre vacio: no muestra el mensaje de vacio', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Sin resultados.');
  });

  it('no proyecta las filas reales', () => {
    expect(fixture.nativeElement.querySelector('.fila-real')).toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [RaTabla],
  template: `
    <ra-tabla [vacio]="true">
      <thead ra-tabla-head>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tr>
        <td class="fila-real">fila real</td>
      </tr>
    </ra-tabla>
  `,
})
class HostVacio {}

describe('RaTabla con vacio=true (sin cargando ni error)', () => {
  let fixture: ComponentFixture<HostVacio>;

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({ imports: [HostVacio] }).createComponent(
      HostVacio,
    );
    fixture.detectChanges();
  });

  it('muestra el mensaje de vacio por defecto', () => {
    expect(fixture.nativeElement.textContent).toContain('Sin resultados.');
  });

  it('no proyecta las filas reales', () => {
    expect(fixture.nativeElement.querySelector('.fila-real')).toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [RaTabla],
  template: `
    <ra-tabla [cargando]="true" mensajeCargando="Espere un momento...">
      <thead ra-tabla-head>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tr>
        <td class="fila-real">fila real</td>
      </tr>
    </ra-tabla>
  `,
})
class HostMensajeCargandoCustom {}

describe('RaTabla con mensajeCargando personalizado', () => {
  it('muestra el mensaje personalizado en vez del default', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostMensajeCargandoCustom],
    }).createComponent(HostMensajeCargandoCustom);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Espere un momento...');
    expect(fixture.nativeElement.textContent).not.toContain('Cargando…');
  });
});

@Component({
  standalone: true,
  imports: [RaTabla],
  template: `
    <ra-tabla [vacio]="true" mensajeVacio="No hay nada aqui todavia">
      <thead ra-tabla-head>
        <tr>
          <th>Columna</th>
        </tr>
      </thead>
      <tr>
        <td class="fila-real">fila real</td>
      </tr>
    </ra-tabla>
  `,
})
class HostMensajeVacioCustom {}

describe('RaTabla con mensajeVacio personalizado', () => {
  it('muestra el mensaje personalizado en vez del default', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [HostMensajeVacioCustom],
    }).createComponent(HostMensajeVacioCustom);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay nada aqui todavia');
    expect(fixture.nativeElement.textContent).not.toContain('Sin resultados.');
  });
});
