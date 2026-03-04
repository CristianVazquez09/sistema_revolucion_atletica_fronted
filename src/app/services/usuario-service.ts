import { Injectable } from '@angular/core';
import { UsuarioData } from '../model/usuario-data';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GenericService } from './generic-service';
import { environment } from '../../environments/environment';

export interface MiPerfilPatch {
  nombre?: string;
  apellido?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService extends GenericService<UsuarioData> {

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/usuarios`);
  }

  patchMiPerfil(data: MiPerfilPatch): Observable<UsuarioData> {
    return this.http.patch<UsuarioData>(`${environment.HOST}/usuarios/mi-perfil`, data);
  }
}
