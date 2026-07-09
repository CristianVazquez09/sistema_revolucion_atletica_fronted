import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AsesoriaNutricionalService } from './asesoria-nutricional-service';
import {
  AsesoriaNutricionalData,
  AsesoriaNutricionalUpsertDTO,
  AsesoriaNutricionalVigenciaDTO,
} from '../model/asesoria-nutricional-data';
import { environment } from '../../environments/environment';
import { SocioData } from '../model/socio-data';

describe('AsesoriaNutricionalService', () => {
  const BASE = `${environment.HOST}/asesorias-nutricionales`;
  let service: AsesoriaNutricionalService;
  let httpMock: HttpTestingController;

  const socioFixture: SocioData = {
    idSocio: 1,
    nombre: 'Juan',
    apellido: 'Pérez',
    direccion: 'Calle 1',
    telefono: '1234567890',
    email: 'juan@example.com',
    fechaNacimiento: '1990-01-01',
    genero: 'MASCULINO',
  };

  const dtoFixture: AsesoriaNutricionalUpsertDTO = {
    idSocio: 1,
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    telefono: '1234567890',
  };

  const responseFixture: AsesoriaNutricionalData = {
    id: 42,
    socio: socioFixture,
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    activo: true,
    telefono: '1234567890',
    creadoEn: '2026-01-01T10:00:00Z',
    actualizadoEn: '2026-01-01T10:00:00Z',
  };

  const vigenciaFixture: AsesoriaNutricionalVigenciaDTO = {
    vigente: true,
  };

  const estadoFixture = {
    asesorado: true,
    vigente: true,
    activo: true,
    estado: 'VIGENTE' as const,
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    idAsesoriaNutricional: 42,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AsesoriaNutricionalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos GET base devuelve array de asesorías', () => {
    service.buscarTodos().subscribe(result => {
      expect(result).toEqual([responseFixture]);
    });
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([responseFixture]);
  });

  it('buscarPorId GET base/{id} devuelve asesoría por id', () => {
    service.buscarPorId(42).subscribe();
    const req = httpMock.expectOne(`${BASE}/42`);
    expect(req.request.method).toBe('GET');
    req.flush(responseFixture);
  });

  it('crear POST base con dto en body', () => {
    service.crear(dtoFixture).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dtoFixture);
    req.flush(responseFixture);
  });

  it('renovar PUT base/{id} con dto en body', () => {
    service.renovar(42, dtoFixture).subscribe();
    const req = httpMock.expectOne(`${BASE}/42`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dtoFixture);
    req.flush(responseFixture);
  });

  it('desactivar PATCH base/{id}/desactivar con {} body', () => {
    service.desactivar(42).subscribe();
    const req = httpMock.expectOne(`${BASE}/42/desactivar`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush(responseFixture);
  });

  it('eliminar DELETE base/{id}', () => {
    service.eliminar(42).subscribe();
    const req = httpMock.expectOne(`${BASE}/42`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('vigente GET base/vigente/{idSocio}', () => {
    service.vigente(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/vigente/7`);
    expect(req.request.method).toBe('GET');
    req.flush(vigenciaFixture);
  });

  it('estado GET base/estado/{idSocio}', () => {
    service.estado(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/estado/7`);
    expect(req.request.method).toBe('GET');
    req.flush(estadoFixture);
  });
});
