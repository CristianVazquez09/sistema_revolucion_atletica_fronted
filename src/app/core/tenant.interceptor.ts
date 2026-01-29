import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  private tenant = inject(TenantContextService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const tid = this.tenant.viewTenantId;

    // ✅ "Todos" => NO header => backend adminAll => ve todo
    if (tid == null) return next.handle(req);

    return next.handle(
      req.clone({
        setHeaders: { 'X-View-Tenant-Id': String(tid) }
      })
    );
  }
}
