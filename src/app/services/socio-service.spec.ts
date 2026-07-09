import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SocioService } from './socio-service';
import { SocioData } from '../model/socio-data';
import { PagedResponse } from '../model/paged-response';
import { AsesoriaContratoData } from '../model/asesoria-contrato-data';
import { TipoPaquete } from '../util/enums/tipo-paquete';
import { environment } from '../../environments/environment';

describe('SocioService', () => {
  const BASE = `${environment.HOST}/socios`;
  let service: SocioService;
  let httpMock: HttpTestingController;

  // AS-IS: este servicio arma el query string a mano (sin HttpParams); se asevera urlWithParams
  const fixture: SocioData = {
    idSocio: 1,
    nombre: 'Juan',
    apellido: 'Pérez',
    direccion: 'Calle Principal 123',
    telefono: '555-1234',
    email: 'juan@example.com',
    fechaNacimiento: '1990-05-15',
    genero: 'MASCULINO',
    comentarios: 'Cliente VIP',
    activo: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SocioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ======== CRUD Heredados ========

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: SocioData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([fixture]);

    expect(resultado).toEqual([fixture]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(1).subscribe();
    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(fixture);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(fixture).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(fixture);
    req.flush(fixture);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(1, fixture).subscribe();
    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(fixture);
    req.flush(fixture);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(1).subscribe();
    const req = httpMock.expectOne(`${BASE}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ======== buscarSocios ========

  it('buscarSocios(0, 5) hace GET a base/buscar?page=0&size=5', () => {
    service.buscarSocios(0, 5).subscribe();

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/buscar?page=0&size=5`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  it('buscarSocios(0, 5, undefined, false) hace GET con ?activo=false', () => {
    service.buscarSocios(0, 5, undefined, false).subscribe();

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/buscar?page=0&size=5&activo=false`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  it('buscarSocios(0, 5, "GIMNASIO") sin activo solo agrega tipoPaquete', () => {
    service.buscarSocios(0, 5, TipoPaquete.GIMNASIO).subscribe();

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/buscar?page=0&size=5&tipoPaquete=GIMNASIO`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  it('buscarSocios(0, 5, "GIMNASIO", true) hace GET con tipoPaquete y activo', () => {
    service.buscarSocios(0, 5, TipoPaquete.GIMNASIO, true).subscribe();

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/buscar?page=0&size=5&tipoPaquete=GIMNASIO&activo=true`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  // ======== buscarSociosPorNombre ========

  it('buscarSociosPorNombre aplica encodeURIComponent y trim al nombre', () => {
    service.buscarSociosPorNombre('ana maría', 0, 5).subscribe();

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/buscar?page=0&size=5&nombre=ana%20mar%C3%ADa`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  it('buscarSociosPorNombre con activo=true incluye activo en query', () => {
    service.buscarSociosPorNombre('test', 1, 10, true).subscribe();

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/buscar?page=1&size=10&nombre=test&activo=true`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 10 });
  });

  it('buscarSociosPorNombre con tipoPaquete y soloVigentes arma el query en orden nombre/tipoPaquete/soloVigentes', () => {
    service.buscarSociosPorNombre('ana', 0, 5, undefined, TipoPaquete.GIMNASIO, true).subscribe();

    const req = httpMock.expectOne(
      r => r.urlWithParams === `${BASE}/buscar?page=0&size=5&nombre=ana&tipoPaquete=GIMNASIO&soloVigentes=true`
    );
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  // ======== obtenerAsesoriasDeSocio ========

  it('obtenerAsesoriasDeSocio hace GET a base/{id}/asesorias?page={p}&size={s}', () => {
    service.obtenerAsesoriasDeSocio(7, 0, 5).subscribe();

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/7/asesorias?page=0&size=5`);
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });
  });

  it('obtenerAsesoriasDeSocio mapea respuesta a PagedResponse con contenido', () => {
    let resultado: PagedResponse<AsesoriaContratoData> | undefined;
    service.obtenerAsesoriasDeSocio(7, 0, 5).subscribe(r => (resultado = r));

    const req = httpMock.expectOne(r => r.urlWithParams === `${BASE}/7/asesorias?page=0&size=5`);
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 });

    expect(resultado?.contenido).toEqual([]);
  });

  // ======== Huella ========

  it('buscarPorHuella con DataURL strip limpia el prefijo base64', () => {
    service.buscarPorHuella('data:image/png;base64,AAAA').subscribe();

    const req = httpMock.expectOne(`${BASE}/buscar-por-huella`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ huellaDigital: 'AAAA' });
    req.flush(fixture);
  });

  it('buscarPorHuella sin prefijo envía como está', () => {
    service.buscarPorHuella('BBBB').subscribe();

    const req = httpMock.expectOne(`${BASE}/buscar-por-huella`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ huellaDigital: 'BBBB' });
    req.flush(fixture);
  });

  it('buscarPorHuella sin coma aplica trim a los espacios', () => {
    service.buscarPorHuella('  BBBB  ').subscribe();

    const req = httpMock.expectOne(`${BASE}/buscar-por-huella`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ huellaDigital: 'BBBB' });
    req.flush(fixture);
  });

  it('registrarHuella limpia base64 y usa key huellaBase64', () => {
    service.registrarHuella(7, 'data:x;base64,CCCC').subscribe();

    const req = httpMock.expectOne(`${BASE}/7/huella`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ huellaBase64: 'CCCC' });
    req.flush(fixture);
  });

  it('actualizarHuella hace PUT con body huellaBase64 limpiado', () => {
    service.actualizarHuella(7, 'DDDD').subscribe();

    const req = httpMock.expectOne(`${BASE}/7/huella`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ huellaBase64: 'DDDD' });
    req.flush(fixture);
  });
});
