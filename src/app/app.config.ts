import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';

import { JwtModule } from '@auth0/angular-jwt';
import { ServerErrorsInterceptor } from './interceptor/server-errors.interceptor';

// NgRx
import { provideStore } from '@ngrx/store';
import { provideState } from '@ngrx/store';

// Usa SIEMPRE el alias común; que angular.json haga fileReplacements
import { environment } from '../environments/environment';
import { inscripcionFeature } from './pages/inscripcion/state/inscripcion-reducer';

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

    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: ServerErrorsInterceptor, multi: true },
    { provide: LocationStrategy, useClass: HashLocationStrategy },

    // 🔴 Faltaba el store raíz
    provideStore(),

    // ✅ Registra tu feature
    provideState(inscripcionFeature),
  ],
};
