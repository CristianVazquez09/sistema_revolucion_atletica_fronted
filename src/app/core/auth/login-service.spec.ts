import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { LoginService } from './login-service';
import { environment } from '../../../environments/environment';

describe('LoginService', () => {
  // Protege el HOST_LOGIN: login NO usa environment.HOST
  let service: LoginService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LoginService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('inicioSesion hace POST a HOST_LOGIN/inicio-sesion con nombreUsuario y contrasenia', () => {
    let resultado: any = undefined;
    service.inicioSesion('ana', 'secreta').subscribe(r => (resultado = r));

    const req = httpMock.expectOne(`${environment.HOST_LOGIN}/inicio-sesion`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombreUsuario: 'ana', contrasenia: 'secreta' });
    req.flush({});

    expect(resultado).toBeDefined();
  });
});
