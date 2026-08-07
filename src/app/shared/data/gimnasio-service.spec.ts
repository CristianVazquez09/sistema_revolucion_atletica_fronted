import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GimnasioService } from './gimnasio-service';
import { GimnasioData } from '../models/gimnasio-data';
import { environment } from '../../../environments/environment';

describe('GimnasioService', () => {
  const BASE = `${environment.HOST}/gimnasios`;
  let service: GimnasioService;
  let httpMock: HttpTestingController;

  const gimnasio: GimnasioData = { idGimnasio: 1, nombre: 'RA Centro', direccion: 'Av. Principal 123', telefono: '5512345678' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GimnasioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: GimnasioData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([gimnasio]);

    expect(resultado).toEqual([gimnasio]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(gimnasio);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(gimnasio).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(gimnasio);
    req.flush(gimnasio);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, gimnasio).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(gimnasio);
    req.flush(gimnasio);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
