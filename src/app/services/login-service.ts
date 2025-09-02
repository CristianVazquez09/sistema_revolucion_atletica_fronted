import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';


interface IInicioSesionRequest {
  nombreUsuario: string;
  contrasenia: string;
}
@Injectable({
  providedIn: 'root'
})
export class LoginService{
  
  private url:string = `http://localhost:8081/inicio-sesion`;

  constructor(
    private http: HttpClient
  ) {}


  inicioSesion(nombreUsuario: string, contrasenia: string) {
    const body: IInicioSesionRequest = { nombreUsuario, contrasenia };
    return this.http.post<any>(this.url, body);
  }
}
