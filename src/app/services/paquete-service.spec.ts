import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PaqueteService } from './paquete-service';
import { PaqueteData } from '../model/paquete-data';
import { PromocionData } from '../model/promocion-data';
import { environment } from '../../environments/environment';
import { TiempoPlan } from '../shared/util/enums/tiempo-plan';
import { TipoPromocion } from '../shared/util/enums/tipo-promocion';

describe('PaqueteService', () => {
  const BASE = `${environment.HOST}/paquetes`;
  let service: PaqueteService;
  let httpMock: HttpTestingController;

  // Patrón para specs de servicios: fixture tipado completo (sin casts por unknown),
  // asertar SIEMPRE método/URL/body del request; el valor de respuesta se asevera
  // una vez por spec (en buscarTodos) porque GenericService no transforma respuestas.
  const paquete: PaqueteData = {
    idPaquete: 4,
    nombre: 'Mensual Basico',
    precio: 50,
    tiempo: TiempoPlan.MENSUAL,
    costoInscripcion: 10,
    activo: true,
    visitasMaximas: null,
  };

  const promocion: PromocionData = {
    idPromocion: 1,
    nombre: 'Descuento Inicio',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-01-31',
    tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
    descuentoPorcentaje: 20,
    activo: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PaqueteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: PaqueteData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([paquete]);

    expect(resultado).toEqual([paquete]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(4).subscribe();
    const req = httpMock.expectOne(`${BASE}/4`);
    expect(req.request.method).toBe('GET');
    req.flush(paquete);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(paquete).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(paquete);
    req.flush(paquete);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(4, paquete).subscribe();
    const req = httpMock.expectOne(`${BASE}/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(paquete);
    req.flush(paquete);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(4).subscribe();
    const req = httpMock.expectOne(`${BASE}/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('buscarPorNombre sin argumentos no manda parámetros', () => {
    let resultado: PaqueteData[] | undefined;
    service.buscarPorNombre().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([paquete]);

    expect(resultado).toEqual([paquete]);
  });

  it('buscarPorNombre con nombre y activo manda ambos parámetros', () => {
    let resultado: PaqueteData[] | undefined;
    service.buscarPorNombre('mensual', true).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('nombre')).toBe('mensual');
    expect(req.request.params.get('activo')).toBe('true');
    req.flush([paquete]);

    expect(resultado).toEqual([paquete]);
  });

  it('buscarPorNombre con espacios omite nombre pero incluye activo', () => {
    let resultado: PaqueteData[] | undefined;
    service.buscarPorNombre('  ', false).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('nombre')).toBeFalse();
    expect(req.request.params.get('activo')).toBe('false');
    req.flush([paquete]);

    expect(resultado).toEqual([paquete]);
  });

  it('buscarPromocionesVigentes hace GET a base/{idPaquete}/promociones con vigentes=true', () => {
    let resultado: PromocionData[] | undefined;
    service.buscarPromocionesVigentes(4).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.url === `${BASE}/4/promociones`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('vigentes')).toBe('true');
    req.flush([promocion]);

    expect(resultado).toEqual([promocion]);
  });

  it('buscarPromociones hace GET a base/{idPaquete}/promociones con vigentes=false por defecto', () => {
    let resultado: PromocionData[] | undefined;
    service.buscarPromociones(4).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.url === `${BASE}/4/promociones`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('vigentes')).toBe('false');
    req.flush([promocion]);

    expect(resultado).toEqual([promocion]);
  });

  it('buscarPromociones con vigentes=true manda vigentes=true', () => {
    let resultado: PromocionData[] | undefined;
    service.buscarPromociones(4, true).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.url === `${BASE}/4/promociones`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('vigentes')).toBe('true');
    req.flush([promocion]);

    expect(resultado).toEqual([promocion]);
  });
});
