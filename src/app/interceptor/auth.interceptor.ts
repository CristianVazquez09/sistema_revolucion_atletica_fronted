// src/app/core/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = req.url.startsWith(environment.HOST); // ej: https://...herokuapp.com
  const isLogin = req.url.endsWith('/inicio-sesion');

  if (isApi && !isLogin) {
    const token = sessionStorage.getItem(environment.TOKEN_NAME); // mismo que usas al guardar
    if (token) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }
  }
  return next(req);
};
