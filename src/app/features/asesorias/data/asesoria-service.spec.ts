import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AsesoriaService } from './asesoria-service';
import { EntrenadorData } from '../../../shared/models/entrenador-data';
import { environment } from '../../../../environments/environment';

describe('AsesoriaService', () => {
  const BASE = `${environment.HOST}/asesorias`;
  let service: AsesoriaService;
  let httpMock: HttpTestingController;

  // AS-IS: AsesoriaService tipa su genérico con EntrenadorData
  const entrenador: EntrenadorData = { idEntrenador: 1, nombre: 'Juan', apellido: 'Pérez', activo: true };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AsesoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: EntrenadorData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([entrenador]);

    expect(resultado).toEqual([entrenador]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(entrenador);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(entrenador).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(entrenador);
    req.flush(entrenador);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, entrenador).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(entrenador);
    req.flush(entrenador);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
