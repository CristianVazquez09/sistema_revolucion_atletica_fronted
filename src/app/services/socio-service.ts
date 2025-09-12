import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';
import { SocioData } from '../model/socio-data';
import { PagedResponse, toPagedResponse } from '../model/paged-response';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocioService extends GenericService<SocioData> {

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/socios`)
  }


  buscarSocios(pagina: number, tamanio: number){
    return this.http
      .get<any>(`${this.url}/buscar?page=${pagina}&size=${tamanio}`);
  }

  buscarSociosPorNombre(nombre: string, pagina: number, tamanio: number){
    return this.http
      .get<any>(`${this.url}/buscar/${encodeURIComponent(nombre)}?page=${pagina}&size=${tamanio}`);
  }
  
  
}
