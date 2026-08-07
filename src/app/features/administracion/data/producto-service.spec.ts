import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProductoService, StockEntradaRequest, StockAjusteRequest } from './producto-service';
import { ProductoData } from '../../../shared/models/producto-data';
import { CategoriaData } from '../../../shared/models/categoria-data';
import { environment } from '../../../../environments/environment';

describe('ProductoService', () => {
  const BASE = `${environment.HOST}/productos`;
  let service: ProductoService;
  let httpMock: HttpTestingController;

  // Patrón para specs de servicios: fixture tipado completo (sin casts por unknown),
  // asertar SIEMPRE método/URL/body del request; el valor de respuesta se asevera
  // una vez por spec (en buscarTodos) porque GenericService no transforma respuestas.
  const categoria: CategoriaData = { idCategoria: 1, nombre: 'Suplementos', activo: true };
  const producto: ProductoData = {
    idProducto: 7,
    nombre: 'Proteína Whey',
    codigo: 'PROT-001',
    precioCompra: 50,
    precioVenta: 100,
    cantidad: 25,
    categoria,
    activo: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: ProductoData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([producto]);

    expect(resultado).toEqual([producto]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(producto);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(producto).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(producto);
    req.flush(producto);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, producto).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(producto);
    req.flush(producto);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('buscarPorCategoria hace GET a base/buscar/{idCategoria}', () => {
    let resultado: ProductoData[] | undefined;
    service.buscarPorCategoria(3).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/buscar/3`);
    expect(req.request.method).toBe('GET');
    req.flush([producto]);

    expect(resultado).toEqual([producto]);
  });

  it('buscarPorNombre hace GET a base/buscar/nombre/{nombreProducto}', () => {
    let resultado: ProductoData[] | undefined;
    service.buscarPorNombre('agua').subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/buscar/nombre/agua`);
    expect(req.request.method).toBe('GET');
    req.flush([producto]);

    expect(resultado).toEqual([producto]);
  });

  it('registrarEntrada hace POST a base/{idProducto}/stock/entrada con StockEntradaRequest', () => {
    const stockEntrada: StockEntradaRequest = { cantidad: 5, nota: 'compra' };
    let resultado: ProductoData | undefined;
    service.registrarEntrada(7, stockEntrada).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/7/stock/entrada`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(stockEntrada);
    req.flush(producto);

    expect(resultado).toEqual(producto);
  });

  it('ajustarStock hace POST a base/{idProducto}/stock/ajuste con StockAjusteRequest', () => {
    const stockAjuste: StockAjusteRequest = { nuevoStock: 20 };
    let resultado: ProductoData | undefined;
    service.ajustarStock(7, stockAjuste).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/7/stock/ajuste`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(stockAjuste);
    req.flush(producto);

    expect(resultado).toEqual(producto);
  });
});
