import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { VentaService, VentaPageResponse } from './venta-service';
import { VentaData } from '../model/venta-data';
import { VentaCreateRequest } from '../model/venta-create';
import { VentaPatchRequest } from '../model/venta-patch';
import { environment } from '../../environments/environment';
import { TipoPago } from '../util/enums/tipo-pago';

describe('VentaService', () => {
  const BASE = `${environment.HOST}/ventas`;
  let service: VentaService;
  let httpMock: HttpTestingController;

  // Fixture completo: VentaData con todos los campos requeridos
  const ventaMock: VentaData = {
    idVenta: 1,
    folio: 100,
    fecha: '2026-07-08',
    total: 150,
    descuento: 10,
    pagos: [
      { tipoPago: 'EFECTIVO' as TipoPago, monto: 140 },
    ],
    detalles: [
      {
        idDetalle: 1,
        producto: {
          idProducto: 1,
          nombre: 'Camiseta',
          codigo: 'P001',
          precioCompra: 50,
          precioVenta: 75,
          cantidad: 10,
          categoria: {
            idCategoria: 1,
            nombre: 'Ropa',
            activo: true,
          },
          activo: true,
        },
        cantidad: 2,
        subTotal: 150,
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VentaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ===== INHERITED CRUD METHODS (GenericService) =====

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: VentaData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([ventaMock]);

    expect(resultado).toEqual([ventaMock]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    let resultado: VentaData | undefined;
    service.buscarPorId(1).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(ventaMock);

    expect(resultado).toEqual(ventaMock);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(ventaMock).subscribe();

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(ventaMock);
    req.flush(ventaMock);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(1, ventaMock).subscribe();

    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(ventaMock);
    req.flush(ventaMock);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(1).subscribe();

    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ===== CREAR VENTA (KEY UNWRAP TESTS) =====

  it('crearVenta desenvuelve array: flush [ventaMock] → subscriber recibe ventaMock (objeto)', () => {
    let resultado: VentaData | undefined;
    const payload: VentaCreateRequest = {
      pagos: [{ tipoPago: 'EFECTIVO' as TipoPago, monto: 140 }],
      detalles: [{ idProducto: 1, cantidad: 2 }],
      descuento: 10,
    };

    service.crearVenta(payload).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    // Backend devuelve array
    req.flush([ventaMock]);

    // Subscriber recibe el primer elemento, no el array
    expect(resultado).toEqual(ventaMock);
    expect(Array.isArray(resultado)).toBe(false);
  });

  it('crearVenta maneja objeto directo: flush ventaMock (plain) → subscriber recibe ventaMock', () => {
    let resultado: VentaData | undefined;
    const payload: VentaCreateRequest = {
      pagos: [{ tipoPago: 'EFECTIVO' as TipoPago, monto: 140 }],
      detalles: [{ idProducto: 1, cantidad: 2 }],
      descuento: 10,
    };

    service.crearVenta(payload).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    // Backend devuelve objeto directo
    req.flush(ventaMock);

    // Subscriber recibe el objeto
    expect(resultado).toEqual(ventaMock);
  });

  // ===== LISTAR (page offset, sort conditional) =====

  it('listar con objeto vacío aplica defaults: page=0, size=10, NO sort', () => {
    const mockResponse: VentaPageResponse = {
      content: [ventaMock],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    let resultado: VentaPageResponse | undefined;
    service.listar({}).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      req.params.get('page') === '0' &&
      req.params.get('size') === '10' &&
      !req.params.has('sort')
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('sort')).toBe(false);
    req.flush(mockResponse);

    expect(resultado).toEqual(mockResponse);
  });

  it('listar con page=3 transforma a page=2 (offset: 3-1)', () => {
    const mockResponse: VentaPageResponse = {
      content: [ventaMock],
      page: { size: 10, number: 2, totalElements: 1, totalPages: 1 },
    };
    service.listar({ page: 3 }).subscribe();

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      req.params.get('page') === '2' &&
      req.params.get('size') === '10' &&
      !req.params.has('sort')
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('listar con sort incluye sort en params', () => {
    const mockResponse: VentaPageResponse = {
      content: [ventaMock],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    service.listar({ page: 3, sort: 'folio,desc' }).subscribe();

    const req = httpMock.expectOne(req =>
      req.url === BASE &&
      req.params.get('page') === '2' &&
      req.params.get('sort') === 'folio,desc'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('sort')).toBe(true);
    req.flush(mockResponse);
  });

  // ===== PATCH =====

  it('patch hace PATCH a base/{id} con VentaPatchRequest', () => {
    const patchRequest: VentaPatchRequest = {
      acciones: [{ op: 'CAMBIAR_DESCUENTO', nuevoDescuento: 20 }],
    };
    service.patch(5, patchRequest).subscribe();

    const req = httpMock.expectOne(`${BASE}/5`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patchRequest);
    req.flush(ventaMock);
  });

  // ===== BUSCAR POR FOLIO =====

  it('buscarPorFolio hace GET a base/folio/{folio}', () => {
    let resultado: VentaData | undefined;
    service.buscarPorFolio(123).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/folio/123`);
    expect(req.request.method).toBe('GET');
    req.flush(ventaMock);

    expect(resultado).toEqual(ventaMock);
  });

  // ===== LISTAR POR RANGO =====

  it('listarPorRango sin sort NO incluye sort en params', () => {
    const mockResponse: VentaPageResponse = {
      content: [ventaMock],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    service.listarPorRango({ desde: '2026-01-01', hasta: '2026-01-31' }).subscribe();

    const req = httpMock.expectOne(req => req.url === `${BASE}/rango`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.has('sort')).toBe(false);
    req.flush(mockResponse);
  });

  it('listarPorRango con sort incluye sort en params', () => {
    const mockResponse: VentaPageResponse = {
      content: [ventaMock],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    };
    service.listarPorRango({ desde: '2026-01-01', hasta: '2026-01-31', sort: 'folio,desc' }).subscribe();

    const req = httpMock.expectOne(req => req.url === `${BASE}/rango`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sort')).toBe('folio,desc');
    req.flush(mockResponse);
  });

  it('listarPorRango con page=2 transforma a page=1 (offset)', () => {
    const mockResponse: VentaPageResponse = {
      content: [ventaMock],
      page: { size: 10, number: 1, totalElements: 1, totalPages: 1 },
    };
    service.listarPorRango({ desde: '2026-01-01', hasta: '2026-01-31', page: 2 }).subscribe();

    const req = httpMock.expectOne(req => req.url === `${BASE}/rango`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(mockResponse);
  });
});
