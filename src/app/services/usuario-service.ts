import { Injectable } from '@angular/core';
import { UsuarioData } from '../model/usuario-data';
import { HttpClient } from '@angular/common/http';
import { GenericService } from './generic-service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService extends GenericService<UsuarioData> {
  
  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/usuarios`)

  }
}
