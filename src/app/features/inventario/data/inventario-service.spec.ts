import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { InventarioService } from './inventario-service';
import { InventarioCierreRequestData } from '../models/inventario-diario-data';
import { environment } from '../../../../environments/environment';

describe('InventarioService', () => {
  const BASE = `${environment.HOST}/inventario`;
  let service: InventarioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InventarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('turno sin gimnasioId NO incluye el param', () => {
    service.turno({ fecha: '2026-07-01', turno: 'MANANA' }).subscribe();

    const req = httpMock.expectOne(r => r.url === `${BASE}/turno`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('fecha')).toBe('2026-07-01');
    expect(req.request.params.get('turno')).toBe('MANANA');
    expect(req.request.params.has('gimnasioId')).toBeFalse();
    req.flush({});
  });

  it('turno con gimnasioId incluye el param', () => {
    service.turno({ fecha: '2026-07-01', turno: 'MANANA', gimnasioId: 2 }).subscribe();

    const req = httpMock.expectOne(r => r.url === `${BASE}/turno`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('gimnasioId')).toBe('2');
    req.flush({});
  });

  it('cerrar hace POST a base/cerrar con el payload como body', () => {
    const payload: InventarioCierreRequestData = {
      fecha: '2026-07-01',
      turno: 'MANANA'
    };
    service.cerrar(payload).subscribe();

    const req = httpMock.expectOne(`${BASE}/cerrar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });
});
