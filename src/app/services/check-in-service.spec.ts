import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CheckInService } from './check-in-service';
import { environment } from '../../environments/environment';

describe('CheckInService', () => {
  const BASE = `${environment.HOST}/asistencias`;
  let service: CheckInService;
  let httpMock: HttpTestingController;

  const paginaVacia = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CheckInService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('registrarEntradaPorMembresia hace POST /checkin con {idMembresia}', () => {
    service.registrarEntradaPorMembresia(42).subscribe();
    const req = httpMock.expectOne(`${BASE}/checkin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idMembresia: 42 });
    req.flush({});
  });

  it('registrarEntradaPorSocio hace POST /checkin con {idSocio}', () => {
    service.registrarEntradaPorSocio(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/checkin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idSocio: 7 });
    req.flush({});
  });

  it('registrarEntradaPorHuella hace POST /checkin/huella con {huellaDigital}', () => {
    service.registrarEntradaPorHuella('base64==').subscribe();
    const req = httpMock.expectOne(`${BASE}/checkin/huella`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ huellaDigital: 'base64==' });
    req.flush({});
  });

  it('listarHistorial manda page y size, sin filtros opcionales', () => {
    service.listarHistorial(0, 5).subscribe();
    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.has('q')).toBeFalse();
    expect(req.request.params.has('origen')).toBeFalse();
    req.flush(paginaVacia);
  });

  it('listarHistorial agrega término y origen cuando vienen', () => {
    service.listarHistorial(1, 10, 'ana', 'HUELLA').subscribe();
    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.params.get('q')).toBe('ana');
    expect(req.request.params.get('origen')).toBe('HUELLA');
    req.flush(paginaVacia);
  });

  it('buscar manda desde/hasta solo cuando están AMBAS fechas', () => {
    service.buscar(0, 5, '2026-01-01', '2026-01-31').subscribe();
    const conFechas = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(conFechas.request.params.get('desde')).toBe('2026-01-01');
    expect(conFechas.request.params.get('hasta')).toBe('2026-01-31');
    conFechas.flush(paginaVacia);

    service.buscar(0, 5, '2026-01-01', undefined).subscribe();
    const sinFechas = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(sinFechas.request.params.has('desde')).toBeFalse();
    expect(sinFechas.request.params.has('hasta')).toBeFalse();
    sinFechas.flush(paginaVacia);
  });

  it('buscar agrega nombre cuando viene', () => {
    service.buscar(0, 5, undefined, undefined, 'ana').subscribe();
    const req = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(req.request.params.get('nombre')).toBe('ana');
    req.flush(paginaVacia);
  });
});
