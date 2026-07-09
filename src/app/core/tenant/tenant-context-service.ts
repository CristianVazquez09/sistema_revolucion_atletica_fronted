import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private jwt = inject(JwtHelperService);

  // ===== VIEW tenant (selector admin) =====
  private viewTenant$ = new BehaviorSubject<number | null>(null);
  viewTenantChanges$ = this.viewTenant$.asObservable();

  get viewTenantId(): number | null {
    return this.viewTenant$.value;
  }

  // ✅ compat con tu código viejo
  getViewTenantId(): number | null {
    return this.viewTenantId;
  }

  setViewTenant(id: number | null) {
    this.viewTenant$.next(id);

    if (id == null) sessionStorage.removeItem('viewTenantId');
    else sessionStorage.setItem('viewTenantId', String(id));
  }

  // ===== ADMIN flag (reactivo) =====
  private isAdmin$ = new BehaviorSubject<boolean>(false);
  isAdminChanges$ = this.isAdmin$.asObservable();

  get isAdmin(): boolean {
    return this.isAdmin$.value;
  }

  /** Llamar al iniciar sesión / app init */
  initFromToken() {
    const token = this.readToken();
    if (!token) {
      this.isAdmin$.next(false);
      this.setViewTenant(null);
      return;
    }

    const d: any = this.jwt.decodeToken(token) || {};
    const admin = this.hasRole(d, 'ADMIN');
    this.isAdmin$.next(admin);

    if (admin) {
      // ✅ ADMIN: por default "Todos" (null) => NO header => backend ve todo
      this.setViewTenant(null);
      return;
    }

    // ✅ NO admin: forzamos tenant del token
    const tid = d?.tenantId ?? d?.gimnasioId ?? d?.id_gimnasio ?? null;
    this.setViewTenant(tid != null ? Number(tid) : null);
  }

  private hasRole(decoded: any, role: string): boolean {
    const auths = decoded?.authorities ?? decoded?.roles ?? [];
    const arr = Array.isArray(auths) ? auths : [auths];

    return arr.some((x: any) => {
      // soporta: "ROLE_ADMIN"  o  { authority: "ROLE_ADMIN" }
      const raw = (typeof x === 'string') ? x : (x?.authority ?? x?.name ?? x?.rol ?? '');
      const s = String(raw ?? '').trim().toUpperCase();
      return s === role || s === `ROLE_${role}`;
    });
  }

  private readToken(): string {
    const keys = [environment.TOKEN_NAME, 'access_token', 'token', 'id_token']
      .filter(Boolean) as string[];

    for (const k of keys) {
      const raw = (sessionStorage.getItem(k) ?? localStorage.getItem(k) ?? '').trim();
      if (raw) return raw.replace(/^Bearer\s+/i, '').trim();
    }
    return '';
  }
}
