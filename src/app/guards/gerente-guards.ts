// src/app/guards/gerente-guards.ts
import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../environments/environment';

export const gerenteGuard: CanMatchFn = () => {
  const router = inject(Router);
  const jwt = inject(JwtHelperService);

  const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
  if (!token) return router.parseUrl('/pages');

  try {
    const d: any = jwt.decodeToken(token);
    const roles: string[] = [
      ...(Array.isArray(d?.roles) ? d.roles : []),
      ...(Array.isArray(d?.authorities) ? d.authorities : []),
      ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
    ]
      .concat([d?.role, d?.rol, d?.perfil].filter(Boolean) as string[])
      .map(r => String(r).toUpperCase());

    const ok = roles.includes('GERENTE') || roles.includes('ROLE_GERENTE');
    return ok ? true : router.parseUrl('/pages');
  } catch {
    return router.parseUrl('/pages');
  }
};
