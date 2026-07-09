import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CorteCajaService } from './corte-caja-service';
import {
  CorteCajaResponseDTO,
  CerrarCorte,
  AbrirCorte,
  CorteCajaPreviewDTO,
  RegistrarSalidaEfectivoRequest,
  SalidaEfectivo,
  CorteDesgloseDTO,
  CorteCajaListado,
  PagedResponse,
} from '../model/corte-caja-data';
import { environment } from '../../environments/environment';

describe('CorteCajaService', () => {
  const BASE = `${environment.HOST}/cortes`;
  let service: CorteCajaService;
  let httpMock: HttpTestingController;

  // Fixture minimal para CorteCajaResponseDTO
  const corteMock: CorteCajaResponseDTO = {
    idCorte: 1,
    apertura: '2026-07-08T08:00:00Z',
    cierre: null,
    estado: 'ABIERTO',
    totalGeneral: 1000,
    totalVentas: 800,
    totalMembresias: 200,
    totalAccesorias: 0,
    desgloses: [],
  };

  const previewMock: CorteCajaPreviewDTO = {
    idCorte: 1,
    apertura: '2026-07-08T08:00:00Z',
    hasta: '2026-07-08T17:00:00Z',
    estado: 'ABIERTO',
    fondoCajaInicial: 500,
    ingresosEfectivo: 1000,
    totalSalidasEfectivo: 0,
    efectivoEsperado: 1500,
    totalGeneral: 1000,
    totalVentas: 800,
    totalMembresias: 200,
    totalAccesorias: 0,
    formasDePago: [],
    tiposDeIngreso: [],
  };

  const salidaMock: SalidaEfectivo = {
    idSalida: 1,
    fecha: '2026-07-08T10:00:00Z',
    concepto: 'Pago de proveedor',
    monto: 100,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CorteCajaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ===== INHERITED CRUD METHODS (GenericService) =====

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: CorteCajaResponseDTO[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([corteMock]);

    expect(resultado).toEqual([corteMock]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    let resultado: CorteCajaResponseDTO | undefined;
    service.buscarPorId(1).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(corteMock);

    expect(resultado).toEqual(corteMock);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(corteMock).subscribe();

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(corteMock);
    req.flush(corteMock);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(1, corteMock).subscribe();

    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(corteMock);
    req.flush(corteMock);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(1).subscribe();

    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ===== ABRIR CORTE (with coercion) =====

  it('abrir hace POST a base/abrir con body {fondoCajaInicial: number}', () => {
    const req_obj: AbrirCorte = { fondoCajaInicial: 500 };
    let resultado: CorteCajaResponseDTO | undefined;
    service.abrir(req_obj).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/abrir`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fondoCajaInicial: 500 });
    req.flush(corteMock);

    expect(resultado).toEqual(corteMock);
  });

  it('abrir con objeto vacío coerciona a {fondoCajaInicial: 0}', () => {
    // Cast necesario porque AbrirCorte.fondoCajaInicial es required en el tipo
    // pero el servicio coerciona Number(req?.fondoCajaInicial ?? 0)
    const req_obj = {} as AbrirCorte;
    service.abrir(req_obj).subscribe();

    const req = httpMock.expectOne(`${BASE}/abrir`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fondoCajaInicial: 0 });
    req.flush(corteMock);
  });

  // ===== CERRAR CORTE =====

  it('cerrar hace POST a base/{id}/cerrar', () => {
    const cerrarReq: CerrarCorte = {
      hasta: '2026-07-08T18:00:00Z',
      efectivoEntregado: 1500,
      efectivoEnCajaConteo: 1500,
    };
    service.cerrar(3, cerrarReq).subscribe();

    const req = httpMock.expectOne(`${BASE}/3/cerrar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cerrarReq);
    req.flush(corteMock);
  });

  // ===== CONSULTAR =====

  it('consultar hace GET a base/{id}', () => {
    let resultado: CorteCajaResponseDTO | undefined;
    service.consultar(3).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/3`);
    expect(req.request.method).toBe('GET');
    req.flush(corteMock);

    expect(resultado).toEqual(corteMock);
  });

  // ===== CONSULTAR ABIERTO (KEY 404 TESTS) =====

  it('consultarAbierto con 200 → subscriber recibe corte', () => {
    let resultado: CorteCajaResponseDTO | null | undefined;
    service.consultarAbierto().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/abierto`);
    expect(req.request.method).toBe('GET');
    req.flush(corteMock);

    expect(resultado).toEqual(corteMock);
  });

  it('consultarAbierto con 404 → subscriber recibe null SIN error', () => {
    let resultado: CorteCajaResponseDTO | null | undefined;
    let errorCalled = false;

    service.consultarAbierto().subscribe({
      next: r => (resultado = r),
      error: () => (errorCalled = true),
    });

    const req = httpMock.expectOne(`${BASE}/abierto`);
    expect(req.request.method).toBe('GET');
    req.flush('', { status: 404, statusText: 'Not Found' });

    expect(resultado).toBeNull();
    expect(errorCalled).toBe(false);
  });

  it('consultarAbierto con 500 → error path es tomado', () => {
    let resultado: CorteCajaResponseDTO | null | undefined;
    let errorReceived: any;

    service.consultarAbierto().subscribe({
      next: r => (resultado = r),
      error: err => (errorReceived = err),
    });

    const req = httpMock.expectOne(`${BASE}/abierto`);
    expect(req.request.method).toBe('GET');
    req.flush('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(errorReceived).toBeDefined();
    expect(errorReceived?.status).toBe(500);
  });

  // ===== PREVISUALIZAR =====

  it('previsualizar sin hasta NO incluye param', () => {
    let resultado: CorteCajaPreviewDTO | undefined;
    service.previsualizar(3).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(req =>
      req.url === `${BASE}/3/preview` &&
      !req.params.has('hasta')
    );
    expect(req.request.method).toBe('GET');
    req.flush(previewMock);

    expect(resultado).toEqual(previewMock);
  });

  it('previsualizar con hasta incluye param', () => {
    let resultado: CorteCajaPreviewDTO | undefined;
    service.previsualizar(3, '2026-07-01').subscribe(r => (resultado = r));

    const req = httpMock.expectOne(req =>
      req.url === `${BASE}/3/preview` &&
      req.params.get('hasta') === '2026-07-01'
    );
    expect(req.request.method).toBe('GET');
    req.flush(previewMock);

    expect(resultado).toEqual(previewMock);
  });

  // ===== PREVISUALIZAR ABIERTO =====

  it('previsualizarAbierto sin hasta NO incluye param', () => {
    let resultado: CorteCajaPreviewDTO | undefined;
    service.previsualizarAbierto().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(req =>
      req.url === `${BASE}/abierto/preview` &&
      !req.params.has('hasta')
    );
    expect(req.request.method).toBe('GET');
    req.flush(previewMock);

    expect(resultado).toEqual(previewMock);
  });

  it('previsualizarAbierto con hasta incluye param', () => {
    let resultado: CorteCajaPreviewDTO | undefined;
    service.previsualizarAbierto('2026-07-01').subscribe(r => (resultado = r));

    const req = httpMock.expectOne(req =>
      req.url === `${BASE}/abierto/preview` &&
      req.params.get('hasta') === '2026-07-01'
    );
    expect(req.request.method).toBe('GET');
    req.flush(previewMock);

    expect(resultado).toEqual(previewMock);
  });

  // ===== REGISTRAR SALIDA Y LISTAR SALIDAS =====

  it('registrarSalida hace POST a base/{id}/salidas', () => {
    const salidarReq: RegistrarSalidaEfectivoRequest = {
      concepto: 'Pago proveedor',
      monto: 100,
    };
    let resultado: SalidaEfectivo | undefined;
    service.registrarSalida(3, salidarReq).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/3/salidas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(salidarReq);
    req.flush(salidaMock);

    expect(resultado).toEqual(salidaMock);
  });

  it('listarSalidas hace GET a base/{id}/salidas', () => {
    let resultado: SalidaEfectivo[] | undefined;
    service.listarSalidas(3).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/3/salidas`);
    expect(req.request.method).toBe('GET');
    req.flush([salidaMock]);

    expect(resultado).toEqual([salidaMock]);
  });

  // ===== DESGLOSE ACTUAL Y DESGLOSE =====

  it('desgloseActual hace GET a base/actual/desglose', () => {
    let resultado: CorteDesgloseDTO | undefined;
    service.desgloseActual().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/actual/desglose`);
    expect(req.request.method).toBe('GET');
    const desgloseResp: CorteDesgloseDTO = {
      corte: corteMock,
      movimientos: [],
      salidas: [],
    };
    req.flush(desgloseResp);

    expect(resultado).toEqual(desgloseResp);
  });

  it('desglose hace GET a base/{id}/desglose', () => {
    let resultado: CorteDesgloseDTO | undefined;
    service.desglose(3).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/3/desglose`);
    expect(req.request.method).toBe('GET');
    const desgloseResp: CorteDesgloseDTO = {
      corte: corteMock,
      movimientos: [],
      salidas: [],
    };
    req.flush(desgloseResp);

    expect(resultado).toEqual(desgloseResp);
  });

  // ===== LISTAR (conditional estado) =====

  it('listar con objeto vacío aplica defaults: page=0, size=10, NO estado, NO sort', () => {
    const mockResponse: PagedResponse<CorteCajaListado> = {
      content: [
        {
          idCorte: 1,
          apertura: '2026-07-08T08:00:00Z',
          cierre: null,
          estado: 'ABIERTO',
          totalGeneral: 1000,
          totalVentas: 800,
          totalMembresias: 200,
          totalAccesorias: 0,
        },
      ],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    let resultado: PagedResponse<CorteCajaListado> | undefined;
    service.listar({}).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      req.params.get('page') === '0' &&
      req.params.get('size') === '10' &&
      !req.params.has('estado') &&
      !req.params.has('sort')
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(resultado).toEqual(mockResponse);
  });

  it('listar con estado=ABIERTO incluye estado param', () => {
    const mockResponse: PagedResponse<CorteCajaListado> = {
      content: [],
      page: { size: 10, number: 0, totalElements: 0, totalPages: 0 },
    };
    service.listar({ estado: 'ABIERTO' }).subscribe();

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      req.params.get('estado') === 'ABIERTO'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('estado')).toBe(true);
    req.flush(mockResponse);
  });

  it('listar con estado=CERRADO incluye estado param', () => {
    const mockResponse: PagedResponse<CorteCajaListado> = {
      content: [],
      page: { size: 10, number: 0, totalElements: 0, totalPages: 0 },
    };
    service.listar({ estado: 'CERRADO' }).subscribe();

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      req.params.get('estado') === 'CERRADO'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('estado')).toBe(true);
    req.flush(mockResponse);
  });

  it('listar con estado=\'\' (empty string) NO incluye estado param', () => {
    const mockResponse: PagedResponse<CorteCajaListado> = {
      content: [],
      page: { size: 10, number: 0, totalElements: 0, totalPages: 0 },
    };
    service.listar({ estado: '' }).subscribe();

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      !req.params.has('estado')
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('estado')).toBe(false);
    req.flush(mockResponse);
  });

  it('listar con estado=ABIERTO, page=2 transforma a page=1 (offset)', () => {
    const mockResponse: PagedResponse<CorteCajaListado> = {
      content: [],
      page: { size: 10, number: 1, totalElements: 0, totalPages: 0 },
    };
    service.listar({ estado: 'ABIERTO', page: 2 }).subscribe();

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      req.params.get('page') === '1' &&
      req.params.get('estado') === 'ABIERTO'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
