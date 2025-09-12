import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import { NotificacionService } from '../services/notificacion-service';
import { NO_GLOBAL_ERROR_TOAST } from './http-error.tokens';
import { getHttpErrorMessage } from './getHttpErrorMessage';


@Injectable({ providedIn: 'root' })
export class ServerErrorsInterceptor implements HttpInterceptor {

  // anti-duplicados básicos: evita spamear el mismo mensaje muchas veces seguidas
  private lastMsg = ''; private lastAt = 0;

  constructor(private noti: NotificacionService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const silent = req.context.get(NO_GLOBAL_ERROR_TOAST) === true;
    const isCorteAbiertoCheck = req.url.includes('/cortes/abierto'); // 404 silencioso

    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          // Convención opcional: { error: true, errorMessage: '...' }
          if (event.body && event.body.error === true && event.body.errorMessage) {
            throw new Error(event.body.errorMessage);
          }
        }
      }),
      catchError(err => {
        // 404 silencioso para "abierto"
        if (err.status === 404 && isCorteAbiertoCheck) {
          return throwError(() => err);
        }

        const msg = getHttpErrorMessage(err);

        // Solo notificar si NO está silenciado
        if (!silent) {
          const now = Date.now();
          if (msg !== this.lastMsg || now - this.lastAt > 1500) { // dedupe 1.5s
            this.noti.error(msg, { duracion: 5000 });
            this.lastMsg = msg; this.lastAt = now;
          }
        }

        return throwError(() => err); // SIEMPRE relanzar para que el componente pueda actuar
      })
    );
  }
}
