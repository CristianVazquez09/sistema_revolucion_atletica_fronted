import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RolService } from './rol-service';
import { RolData } from '../shared/models/rol-data';
import { environment } from '../../environments/environment';

describe('RolService', () => {
  const BASE = `${environment.HOST}/roles`;
  let service: RolService;
  let httpMock: HttpTestingController;

  const rol: RolData = { idRol: 1, nombre: 'ADMIN', descripcion: 'Administrador' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RolService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: RolData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([rol]);

    expect(resultado).toEqual([rol]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(rol);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(rol).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(rol);
    req.flush(rol);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, rol).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(rol);
    req.flush(rol);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
