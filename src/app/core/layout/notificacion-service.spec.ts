import { TestBed } from '@angular/core/testing';
import { NotificacionService } from './notificacion-service';

describe('NotificacionService', () => {
  let service: NotificacionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificacionService);
    service.limpiar();
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it("exito('Guardado') → notificaciones() tiene 1 item con tipo 'exito', mensaje 'Guardado', duracion 5000", () => {
    service.exito('Guardado');
    const nots = service.notificaciones();
    expect(nots.length).toBe(1);
    expect(nots[0].tipo).toBe('exito');
    expect(nots[0].mensaje).toBe('Guardado');
    expect(nots[0].duracion).toBe(5000);
  });

  it('shortcuts error/info/aviso setean tipo correctamente', () => {
    const idError = service.error('Falló');
    const idInfo = service.info('Info');
    const idAviso = service.aviso('Aviso');

    const nots = service.notificaciones();
    expect(nots.length).toBe(3);
    expect(nots.find((n) => n.id === idError)?.tipo).toBe('error');
    expect(nots.find((n) => n.id === idInfo)?.tipo).toBe('info');
    expect(nots.find((n) => n.id === idAviso)?.tipo).toBe('aviso');
  });

  it("abrir({mensaje: 'X'}) retorna numeric id y defaultea tipo 'info'", () => {
    const id = service.abrir({ mensaje: 'Test mensaje' });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);

    const nots = service.notificaciones();
    expect(nots.length).toBe(1);
    expect(nots[0].tipo).toBe('info');
    expect(nots[0].id).toBe(id);
  });

  it('cerrar(id) remueve solo esa notificacion', () => {
    const id1 = service.abrir({ mensaje: 'Noti 1' });
    const id2 = service.abrir({ mensaje: 'Noti 2' });
    expect(service.notificaciones().length).toBe(2);

    service.cerrar(id1);
    const nots = service.notificaciones();
    expect(nots.length).toBe(1);
    expect(nots[0].id).toBe(id2);
  });

  it("auto-close: exito('temp'), assert presente, tick(5001) → desaparece", () => {
    service.exito('temp');
    expect(service.notificaciones().length).toBe(1);

    jasmine.clock().tick(5001);
    expect(service.notificaciones().length).toBe(0);
  });

  it("duracion customizada: abrir({mensaje:'Y', duracion: 1000}), tick(999) → presente, tick(2) → gone", () => {
    service.abrir({ mensaje: 'Y', duracion: 1000 });
    expect(service.notificaciones().length).toBe(1);

    jasmine.clock().tick(999);
    expect(service.notificaciones().length).toBe(1);

    jasmine.clock().tick(2);
    expect(service.notificaciones().length).toBe(0);
  });

  it('limpiar() vacia todo', () => {
    service.exito('Uno');
    service.error('Dos');
    service.info('Tres');
    expect(service.notificaciones().length).toBe(3);

    service.limpiar();
    expect(service.notificaciones().length).toBe(0);
  });
});
