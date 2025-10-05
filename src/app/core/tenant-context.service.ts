import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';

export type TenantId = number | null;

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private jwt = inject(JwtHelperService);

  // Derivados del token
  readonly homeTenantId: number | null;
  readonly isAdmin: boolean;

  // Ámbito de lectura: null = TODOS; number = filtrar por ese gimnasio
  private viewTenantIdSub = new BehaviorSubject<TenantId>(null);
  viewTenantId$ = this.viewTenantIdSub.asObservable();

  // Destino de escritura: por defecto usa viewTenantId si no se especifica en formularios
  // (puedes decidir usar SIEMPRE el valor del formulario y dejar este como fallback)
  private writeTenantIdSub = new BehaviorSubject<TenantId>(null);
  writeTenantId$ = this.writeTenantIdSub.asObservable();

  constructor() {
    const raw = sessionStorage.getItem('auth_token') ?? '';
    let decoded: any = {};
    try { decoded = this.jwt.decodeToken(raw) || {}; } catch {}

    // id del gimnasio “hogar” (para no-admin y como fallback)
    this.homeTenantId = Number(decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId ?? NaN) || null;

    // detección robusta de rol admin (ajusta a tu token real)
    const roles: string[] = [
      ...(decoded?.roles ?? []),
      ...(decoded?.authorities ?? []),
      ...((decoded?.realm_access?.roles ?? []) as string[])
    ].map(String);

    this.isAdmin = roles.some(r => ['ADMIN'].includes(r));

    // Estado inicial
    this.viewTenantIdSub.next(this.isAdmin ? null : this.homeTenantId);
    this.writeTenantIdSub.next(this.isAdmin ? null : this.homeTenantId);
  }

  setViewTenant(id: TenantId) { this.viewTenantIdSub.next(id); }
  setWriteTenant(id: TenantId) { this.writeTenantIdSub.next(id); }

  /** Decide un tenant destino de escritura:
   *  1) si admin y se especificó en form -> ese
   *  2) si admin y NO hay en form -> usa writeTenantId (o lanza error si es null)
   *  3) si no-admin -> homeTenantId
   */
  resolveWriteTenant(explicit?: TenantId): number | null {
    if (this.isAdmin) {
      if (explicit != null) return explicit;
      return this.writeTenantIdSub.value;
    }
    return this.homeTenantId;
  }
}
