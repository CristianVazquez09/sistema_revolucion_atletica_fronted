import { ApplicationConfig, importProvidersFrom, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';

import { JwtModule } from '@auth0/angular-jwt';
import { ServerErrorsInterceptor } from './interceptor/server-errors.interceptor';

import { provideStore } from '@ngrx/store';
import { provideState } from '@ngrx/store';

import { environment } from '../environments/environment';
import { inscripcionFeature } from './pages/inscripcion/state/inscripcion-reducer';
import { TenantInterceptor } from './core/tenant.interceptor';
import { REINSCRIPCION_FEATURE_KEY, reinscripcionReducer } from './pages/reinscripcion/state/reinscripcion-reducer';

export function tokenGetter() {
  return sessionStorage.getItem(environment.TOKEN_NAME);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    importProvidersFrom(
      JwtModule.forRoot({
        config: {
          tokenGetter,
          allowedDomains: ['localhost:8081'],
          disallowedRoutes: ['http://localhost:8080/inicio-sesion'],
        },
      })
    ),

    // 👇 Solo UNA llamada a provideHttpClient y usando withInterceptorsFromDi
    provideHttpClient(withInterceptorsFromDi()),

    // Interceptors de DI (en orden)
    { provide: HTTP_INTERCEPTORS, useClass: ServerErrorsInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: TenantInterceptor,        multi: true },

    { provide: LocationStrategy, useClass: HashLocationStrategy },

    provideStore(),
    provideState(inscripcionFeature),
    { provide: LOCALE_ID, useValue: 'es-MX' },
     provideState(REINSCRIPCION_FEATURE_KEY, reinscripcionReducer),
    
    
  ],
};
