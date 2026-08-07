import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CategoriaService } from './categoria-service';
import { CategoriaData } from '../../../shared/models/categoria-data';
import { environment } from '../../../../environments/environment';

describe('CategoriaService', () => {
  const BASE = `${environment.HOST}/categorias`;
  let service: CategoriaService;
  let httpMock: HttpTestingController;

  // Patrón para specs de servicios: fixture tipado completo (sin casts por unknown),
  // asertar SIEMPRE método/URL/body del request; el valor de respuesta se asevera
  // una vez por spec (en buscarTodos) porque GenericService no transforma respuestas.
  const categoria: CategoriaData = { idCategoria: 1, nombre: 'Suplementos', activo: true };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: CategoriaData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([categoria]);

    expect(resultado).toEqual([categoria]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(categoria);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(categoria).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(categoria);
    req.flush(categoria);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, categoria).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(categoria);
    req.flush(categoria);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
