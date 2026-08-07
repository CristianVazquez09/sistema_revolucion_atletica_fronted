import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MembresiaService, MembresiaPageResponse } from './membresia-service';
import { MembresiaData } from '../models/membresia-data';
import { MembresiaPatchRequest } from '../models/membresia-patch';
import { PagedResponse } from '../models/paged-response';
import { environment } from '../../../environments/environment';
import { TipoMovimiento } from '../util/enums/tipo-movimiento';
import { TipoPago } from '../util/enums/tipo-pago';
import { TiempoPlan } from '../util/enums/tiempo-plan';

describe('MembresiaService', () => {
  const BASE = `${environment.HOST}/membresias`;
  let service: MembresiaService;
  let httpMock: HttpTestingController;

  // Fixture completo: MembresiaData con todos los campos requeridos
  const membresia: MembresiaData = {
    idMembresia: 1,
    folio: 123,
    socio: {
      idSocio: 7,
      nombre: 'Ana',
      apellido: 'García',
      direccion: 'Calle Principal 123',
      telefono: '555-1234',
      email: 'ana@example.com',
      fechaNacimiento: '1990-05-15',
      genero: 'FEMENINO',
      activo: true,
    },
    paquete: {
      idPaquete: 1,
      nombre: 'Plan Mensual',
      precio: 50,
      tiempo: TiempoPlan.MENSUAL,
      costoInscripcion: 10,
      activo: true,
    },
    fechaInicio: '2026-01-01',
    fechaFin: '2026-01-31',
    movimiento: 'INSCRIPCION' as TipoMovimiento,
    pagos: [{ tipoPago: 'EFECTIVO' as TipoPago, monto: 60 }],
    descuento: 5,
    total: 55,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MembresiaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ===== INHERITED CRUD METHODS (GenericService) =====

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: MembresiaData[] | undefined;
    service.buscarTodos().subscribe((r) => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([membresia]);

    expect(resultado).toEqual([membresia]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(1).subscribe();
    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(membresia);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(membresia).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(membresia);
    req.flush(membresia);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(1, membresia).subscribe();
    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(membresia);
    req.flush(membresia);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(1).subscribe();
    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ===== SPECIFIC MEMBRESIA METHODS =====

  it('buscarMembresiasPorSocio construye URL manual con query string', () => {
    let resultado: PagedResponse<MembresiaData> | undefined;
    service.buscarMembresiasPorSocio(7, 0, 5).subscribe((r) => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/buscar/socio/7?page=0&size=5`);
    expect(req.request.method).toBe('GET');
    req.flush({
      content: [],
      page: { totalElements: 0, totalPages: 0, number: 0, size: 5 },
    });

    expect(resultado).toEqual({
      contenido: [],
      pagina: {
        tamanio: 5,
        numero: 0,
        totalElementos: 0,
        totalPaginas: 0,
      },
    });
  });

  it('buscarMembresiasVigentesPorSocio hace GET a por-socio/{id}/vigentes', () => {
    let resultado: MembresiaData[] | undefined;
    service.buscarMembresiasVigentesPorSocio(7).subscribe((r) => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/por-socio/7/vigentes`);
    expect(req.request.method).toBe('GET');
    req.flush([membresia]);

    expect(resultado).toEqual([membresia]);
  });

  // ===== LISTAR (page offset, defaults) =====

  it('listar con objeto vacio aplica defaults: page=0, size=10, sort=fechaInicio,desc', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    let resultado: MembresiaPageResponse | undefined;
    service.listar({}).subscribe((r) => (resultado = r));

    const req = httpMock.expectOne(
      (req) =>
        req.url === BASE &&
        req.params.get('page') === '0' &&
        req.params.get('size') === '10' &&
        req.params.get('sort') === 'fechaInicio,desc',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(resultado).toEqual(mockResponse);
  });

  it('listar con page=3 transforma a page=2 (offset: 3-1)', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 20, number: 2, totalElements: 1, totalPages: 1 },
    };
    service.listar({ page: 3, size: 20, sort: 'folio,asc' }).subscribe();

    const req = httpMock.expectOne(
      (req) =>
        req.url === BASE &&
        req.params.get('page') === '2' &&
        req.params.get('size') === '20' &&
        req.params.get('sort') === 'folio,asc',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('listar con page=0 clampea a 0 (Math.max(0, 0-1))', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    service.listar({ page: 0 }).subscribe();

    const req = httpMock.expectOne(
      (req) =>
        req.url === BASE &&
        req.params.get('page') === '0' &&
        req.params.get('size') === '10' &&
        req.params.get('sort') === 'fechaInicio,desc',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  // ===== PATCH =====

  it('patch hace PATCH a base/{id} con MembresiaPatchRequest', () => {
    const patchRequest: MembresiaPatchRequest = {
      acciones: [{ op: 'CAMBIAR_DESCUENTO', nuevoDescuento: 50 }],
    };
    service.patch(5, patchRequest).subscribe();

    const req = httpMock.expectOne(`${BASE}/5`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patchRequest);
    req.flush(membresia);
  });

  // ===== BUSCAR POR FOLIO =====

  it('buscarPorFolio hace GET a base/folio/{folio}', () => {
    let resultado: MembresiaData | undefined;
    service.buscarPorFolio(123).subscribe((r) => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/folio/123`);
    expect(req.request.method).toBe('GET');
    req.flush(membresia);

    expect(resultado).toEqual(membresia);
  });

  // ===== BUSCAR POR NOMBRE SOCIO (PAGINADO) =====

  it('buscarPorNombreSocio con opciones vacías aplica defaults', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    service.buscarPorNombreSocio('ana', {}).subscribe();

    const req = httpMock.expectOne((req) => req.url === `${BASE}/buscar/socio-nombre`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('ana');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('fechaInicio,desc');
    req.flush(mockResponse);
  });

  it('buscarPorNombreSocio con page=2 transforma a page=1 (offset)', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 15, number: 1, totalElements: 1, totalPages: 1 },
    };
    service.buscarPorNombreSocio('juan', { page: 2, size: 15 }).subscribe();

    const req = httpMock.expectOne((req) => req.url === `${BASE}/buscar/socio-nombre`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('juan');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('size')).toBe('15');
    expect(req.request.params.get('sort')).toBe('fechaInicio,desc');
    req.flush(mockResponse);
  });

  // ===== LISTAR POR RANGO =====

  it('listarPorRango sin sort NO incluye sort en params', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    service.listarPorRango('2026-01-01', '2026-01-31', {}).subscribe();

    const req = httpMock.expectOne((req) => req.url === `${BASE}/rango`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.has('sort')).toBe(false);
    req.flush(mockResponse);
  });

  it('listarPorRango con sort incluye sort en params', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    service.listarPorRango('2026-01-01', '2026-01-31', { sort: 'folio,asc' }).subscribe();

    const req = httpMock.expectOne((req) => req.url === `${BASE}/rango`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('folio,asc');
    req.flush(mockResponse);
  });

  it('listarPorRango con page=2 transforma a page=1 (offset)', () => {
    const mockResponse: MembresiaPageResponse = {
      content: [membresia],
      page: { size: 10, number: 1, totalElements: 1, totalPages: 1 },
    };
    service.listarPorRango('2026-01-01', '2026-01-31', { page: 2 }).subscribe();

    const req = httpMock.expectOne((req) => req.url === `${BASE}/rango`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(mockResponse);
  });

  // ===== REINSCRIPCION ANTICIPADA =====

  it('reinscripcionAnticipada hace POST a base/reinscripcion/anticipada', () => {
    const payload: Partial<MembresiaData> = { descuento: 0 };
    service.reinscripcionAnticipada(payload).subscribe();

    const req = httpMock.expectOne(`${BASE}/reinscripcion/anticipada`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(membresia);
  });

  // ===== GUARDAR BATCH =====

  it('guardarBatch hace POST a base/batch con body {membresias: [...]}', () => {
    const batch = [{ idPaquete: 1 }];
    service.guardarBatch(batch).subscribe();

    const req = httpMock.expectOne(`${BASE}/batch`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ membresias: batch });
    req.flush([membresia]);
  });

  // ===== REINSCRIPCION ANTICIPADA BATCH =====

  it('reinscripcionAnticipadaBatch hace POST a base/batch/reinscripcion/anticipada', () => {
    const batch = [{ descuento: 10 }];
    service.reinscripcionAnticipadaBatch(batch).subscribe();

    const req = httpMock.expectOne(`${BASE}/batch/reinscripcion/anticipada`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ membresias: batch });
    req.flush([membresia]);
  });
});
