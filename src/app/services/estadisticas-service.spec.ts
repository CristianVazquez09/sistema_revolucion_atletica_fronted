import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { EstadisticasService } from './estadisticas-service';
import { environment } from '../../environments/environment';

describe('EstadisticasService', () => {
  const BASE = `${environment.HOST}/estadisticas/dashboard`;
  let service: EstadisticasService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EstadisticasService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getDashboard sin idGimnasio NO incluye el param', () => {
    service.getDashboard(null, '2026-01-01', '2026-01-31').subscribe();

    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    expect(req.request.params.has('idGimnasio')).toBeFalse();
    // DashboardResponse shape is huge; asserting the request is enough
    req.flush({});
  });

  it('getDashboard con idGimnasio incluye el param', () => {
    service.getDashboard(3, '2026-01-01', '2026-01-31').subscribe();

    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('idGimnasio')).toBe('3');
    req.flush({});
  });
});
