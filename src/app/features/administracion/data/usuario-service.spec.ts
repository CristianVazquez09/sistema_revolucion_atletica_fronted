import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { UsuarioService } from './usuario-service';
import { UsuarioData } from '../../../shared/models/usuario-data';
import { environment } from '../../../../environments/environment';

describe('UsuarioService', () => {
  const BASE = `${environment.HOST}/usuarios`;
  let service: UsuarioService;
  let httpMock: HttpTestingController;

  // Patrón para specs de servicios: fixture tipado completo (sin casts por unknown),
  // asertar SIEMPRE método/URL/body del request; el valor de respuesta se asevera
  // una vez por spec (en buscarTodos) porque GenericService no transforma respuestas.
  const usuario: UsuarioData = {
    id: 1,
    nombreUsuario: 'ana',
    nombre: 'Ana',
    apellido: 'García',
    activo: true,
    roles: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsuarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: UsuarioData[] | undefined;
    service.buscarTodos().subscribe((r) => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([usuario]);

    expect(resultado).toEqual([usuario]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(usuario);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(usuario).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(usuario);
    req.flush(usuario);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, usuario).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(usuario);
    req.flush(usuario);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('patchMiPerfil hace PATCH a base/mi-perfil con la data como body', () => {
    const patchData = { nombre: 'Ana', apellido: 'García' };
    service.patchMiPerfil(patchData).subscribe();
    const req = httpMock.expectOne(`${BASE}/mi-perfil`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patchData);
    req.flush(usuario);
  });
});
