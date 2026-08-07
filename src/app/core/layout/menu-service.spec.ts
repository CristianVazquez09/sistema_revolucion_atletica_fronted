import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MenuService } from './menu-service';
import { MenuData } from '../../shared/models/menu-data';
import { RolData } from '../../shared/models/rol-data';
import { environment } from '../../../environments/environment';

describe('MenuService', () => {
  const BASE = `${environment.HOST}/menus`;
  let service: MenuService;
  let httpMock: HttpTestingController;

  const rol: RolData = { nombre: 'Admin', descripcion: 'Administrador' };
  const menu: MenuData = { idMenu: 1, icono: 'home', nombre: 'Inicio', url: '/home', roles: [rol] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MenuService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: MenuData[] | undefined;
    service.buscarTodos().subscribe((r) => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([menu]);

    expect(resultado).toEqual([menu]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(menu);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(menu).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(menu);
    req.flush(menu);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, menu).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(menu);
    req.flush(menu);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getMenusByUser hace POST a base/usuario con username como body', () => {
    // AS-IS: el body es el username como string plano, no un objeto
    service.getMenusByUser('ana').subscribe();
    const req = httpMock.expectOne(`${BASE}/usuario`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe('ana');
    req.flush([menu]);
  });
});

describe('MenuService drawer signals', () => {
  let service: MenuService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(MenuService);
  });

  it('menuAbierto inicia en false', () => {
    expect(service.menuAbierto()).toBeFalse();
  });

  it('toggleDrawer invierte el estado', () => {
    expect(service.menuAbierto()).toBeFalse();
    service.toggleDrawer();
    expect(service.menuAbierto()).toBeTrue();
    service.toggleDrawer();
    expect(service.menuAbierto()).toBeFalse();
  });

  it('abrirDrawer establece true', () => {
    service.cerrarDrawer();
    expect(service.menuAbierto()).toBeFalse();
    service.abrirDrawer();
    expect(service.menuAbierto()).toBeTrue();
  });

  it('cerrarDrawer establece false', () => {
    service.abrirDrawer();
    expect(service.menuAbierto()).toBeTrue();
    service.cerrarDrawer();
    expect(service.menuAbierto()).toBeFalse();
  });
});
