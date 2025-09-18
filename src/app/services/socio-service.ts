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


   buscarSocios(pagina: number, tamanio: number): Observable<PagedResponse<SocioData>> {
    return this.http
      .get(`${this.url}/buscar?page=${pagina}&size=${tamanio}`)
      .pipe(map((raw: any) => toPagedResponse<SocioData>(raw)));
  }

  /** Listado paginado filtrando por nombre */
  buscarSociosPorNombre(nombre: string, pagina: number, tamanio: number): Observable<PagedResponse<SocioData>> {
    const n = encodeURIComponent((nombre ?? '').trim());
    return this.http
      .get(`${this.url}/buscar/${n}?page=${pagina}&size=${tamanio}`)
      .pipe(map((raw: any) => toPagedResponse<SocioData>(raw)));
  }
  
  
}
