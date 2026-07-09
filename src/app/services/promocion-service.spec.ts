import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PromocionService } from './promocion-service';
import { PromocionData, PromocionUpsertData } from '../shared/models/promocion-data';
import { TipoPromocion } from '../shared/util/enums/tipo-promocion';
import { environment } from '../../environments/environment';

describe('PromocionService', () => {
  const BASE = `${environment.HOST}/promociones`;
  let service: PromocionService;
  let httpMock: HttpTestingController;

  // Patrón para specs de servicios: fixture tipado completo (sin casts por unknown),
  // asertar SIEMPRE método/URL/body del request; el valor de respuesta se asevera
  // una vez por spec (en buscarTodos) porque GenericService no transforma respuestas.
  const promocionUpsert: PromocionUpsertData = {
    nombre: 'Descuento 20%',
    descripcion: 'Promoción de verano',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
    descuentoPorcentaje: 20,
    activo: true,
  };

  const promocion: PromocionData = {
    idPromocion: 9,
    nombre: 'Descuento 20%',
    descripcion: 'Promoción de verano',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
    descuentoPorcentaje: 20,
    activo: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PromocionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listar hace GET a la URL base', () => {
    let resultado: PromocionData[] | undefined;
    service.listar().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([promocion]);

    expect(resultado).toEqual([promocion]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(9).subscribe();
    const req = httpMock.expectOne(`${BASE}/9`);
    expect(req.request.method).toBe('GET');
    req.flush(promocion);
  });

  it('crear hace POST a la base con el payload como body', () => {
    service.crear(promocionUpsert).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(promocionUpsert);
    req.flush(promocion);
  });

  it('actualizarPromocion hace PUT a base/{id} con el payload como body', () => {
    service.actualizarPromocion(9, promocionUpsert).subscribe();
    const req = httpMock.expectOne(`${BASE}/9`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(promocionUpsert);
    req.flush(promocion);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(9).subscribe();
    const req = httpMock.expectOne(`${BASE}/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('activar hace PATCH a base/{id}/activar con body null', () => {
    service.activar(9).subscribe();
    const req = httpMock.expectOne(`${BASE}/9/activar`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBeNull();
    req.flush(promocion);
  });

  it('desactivar hace PATCH a base/{id}/desactivar con body null', () => {
    service.desactivar(9).subscribe();
    const req = httpMock.expectOne(`${BASE}/9/desactivar`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBeNull();
    req.flush(promocion);
  });

  it('vincularPaquete hace PUT a paquetes/{idPaquete}/promociones/{idPromocion} con body null', () => {
    // OJO: el orden de ids en la URL va invertido respecto a los argumentos (paquete primero)
    service.vincularPaquete(9, 4).subscribe();
    const req = httpMock.expectOne(`${environment.HOST}/paquetes/4/promociones/9`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBeNull();
    req.flush(null);
  });

  it('desvincularPaquete hace DELETE a paquetes/{idPaquete}/promociones/{idPromocion}', () => {
    service.desvincularPaquete(9, 4).subscribe();
    const req = httpMock.expectOne(`${environment.HOST}/paquetes/4/promociones/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('asignarPaquete delega a vincularPaquete', () => {
    service.asignarPaquete(9, 4).subscribe();
    const req = httpMock.expectOne(`${environment.HOST}/paquetes/4/promociones/9`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBeNull();
    req.flush(null);
  });
});
