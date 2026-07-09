import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ReportesService } from './reportes-service';
import { GimnasioData } from '../shared/models/gimnasio-data';
import { environment } from '../../environments/environment';

describe('ReportesService', () => {
  const BASE = environment.HOST;
  let service: ReportesService;
  let httpMock: HttpTestingController;

  const gimnasio: GimnasioData = { idGimnasio: 1, nombre: 'Gimnasio Central', direccion: 'Calle 1', telefono: '555-0001' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('listarGimnasios hace GET a base/gimnasios', () => {
    let resultado: GimnasioData[] | undefined;
    service.listarGimnasios().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${BASE}/gimnasios`);
    expect(req.request.method).toBe('GET');
    req.flush([gimnasio]);

    expect(resultado).toEqual([gimnasio]);
  });

  it('descargarExcelMovimientos sin idGimnasio manda desde/hasta y responseType blob', () => {
    service.descargarExcelMovimientos(null, '2026-01-01', '2026-01-31').subscribe();

    const req = httpMock.expectOne(`${BASE}/reportes/movimientos/excel?desde=2026-01-01&hasta=2026-01-31`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    expect(req.request.params.has('idGimnasio')).toBeFalse();
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob([]));
  });

  it('descargarExcelMovimientos con idGimnasio incluye el parámetro', () => {
    service.descargarExcelMovimientos(2, '2026-01-01', '2026-01-31').subscribe();

    const req = httpMock.expectOne(r => r.url === `${BASE}/reportes/movimientos/excel`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-01-01');
    expect(req.request.params.get('hasta')).toBe('2026-01-31');
    expect(req.request.params.get('idGimnasio')).toBe('2');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob([]));
  });
});
