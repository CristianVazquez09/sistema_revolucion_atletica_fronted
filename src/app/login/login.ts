// login.ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { LoginService } from '../services/login-service';
import { NotificacionService } from '../services/notificacion-service';
import { environment } from '../../environments/environment';
import { JwtHelperService } from '@auth0/angular-jwt';

interface LoginResponse {
  access_token: string;
  username: string; // <- viene en tu payload
  authorities: string[]; // <- opcional
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
})
export class Login {
  private loginService = inject(LoginService);
  private router = inject(Router);
  private noti = inject(NotificacionService);
  private jwt = inject(JwtHelperService);

  usuario = '';
  clave = '';
  cargando = false;
verClave = false;

  onSubmit() {
    if (!this.usuario || !this.clave) {
      this.noti.aviso('Ingrese usuario y contrasena');
      return;
    }
    this.cargando = true;

    this.loginService
      .inicioSesion(this.usuario, this.clave)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe((data: LoginResponse) => {
        sessionStorage.setItem(environment.TOKEN_NAME, data.access_token);
        sessionStorage.setItem('username', data.username); // <- GUARDA EL NOMBRE

        const decoded: any = this.jwt.decodeToken(data.access_token);
        if (decoded?.tenantId != null) {
          sessionStorage.setItem('tenantId', String(decoded.tenantId));
        }
        this.router.navigate(['pages']);
      });
  }
}
