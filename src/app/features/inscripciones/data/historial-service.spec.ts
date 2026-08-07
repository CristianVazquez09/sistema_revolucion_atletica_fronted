import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { HistorialService } from './historial-service';
import { environment } from '../../../../environments/environment';

describe('HistorialService', () => {
  const BASE = `${environment.HOST}/historial`;
  let service: HistorialService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HistorialService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('consultar manda page y size como params', () => {
    let resultado: any;
    service.consultar(0, 5).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('5');

    // Simular respuesta Spring Data
    const springResponse = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 };
    req.flush(springResponse);

    // toPagedResponse mapea content a contenido
    expect(resultado?.contenido).toEqual([]);
  });
});
