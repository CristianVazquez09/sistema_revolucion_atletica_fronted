import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  private tenant = inject(TenantContextService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const method = req.method.toUpperCase();
    const isReading = method === 'GET';
    const isMutating = ['POST','PUT','PATCH','DELETE'].includes(method);

    let clone = req;

    if (isReading && this.tenant.isAdmin) {
      const viewTenant = (this.tenant as any)['viewTenantIdSub']?.value ?? null;
      if (viewTenant != null) {
        clone = clone.clone({ setHeaders: { 'X-Target-Tenant-Id': String(viewTenant) } });
      }
    }

    if (isMutating && this.tenant.isAdmin) {
      const hasGym = clone.body && typeof clone.body === 'object' && clone.body['gimnasio'];
      if (!hasGym) {
        const writeTenant = this.tenant.resolveWriteTenant();
        if (writeTenant == null) {
          return throwError(() => new HttpErrorResponse({
            status: 400,
            statusText: 'Bad Request',
            error: { message: 'Admin: debes seleccionar un gimnasio antes de guardar.' }
          }));
        }
        const newBody = { ...(clone.body ?? {}), gimnasio: { idGimnasio: writeTenant } };
        clone = clone.clone({ body: newBody });
      }
    }

    return next.handle(clone);
  }
}
