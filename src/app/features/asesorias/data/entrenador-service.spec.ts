import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EntrenadorService } from './entrenador-service';
import { EntrenadorData } from '../../../shared/models/entrenador-data';
import { environment } from '../../../../environments/environment';

describe('EntrenadorService', () => {
  const BASE = `${environment.HOST}/entrenadores`;
  let service: EntrenadorService;
  let httpMock: HttpTestingController;

  // Patrón para specs de servicios: fixture tipado completo (sin casts por unknown),
  // asertar SIEMPRE método/URL/body del request; el valor de respuesta se asevera
  // una vez por spec (en buscarTodos) porque GenericService no transforma respuestas.
  const entrenador: EntrenadorData = {
    idEntrenador: 1,
    nombre: 'Juan',
    apellido: 'Pérez',
    activo: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EntrenadorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: EntrenadorData[] | undefined;
    service.buscarTodos().subscribe((r) => (resultado = r));

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

  it('listarAsesoriasActivas hace GET a base/{id}/asesorias-activas', () => {
    service.listarAsesoriasActivas(5).subscribe();
    const req = httpMock.expectOne(`${BASE}/5/asesorias-activas`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
