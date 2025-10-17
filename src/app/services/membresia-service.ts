import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';

import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { MembresiaData } from '../model/membresia-data';
import { PagedResponse, toPagedResponse } from '../model/paged-response';
import { Observable, map } from 'rxjs';

type PageMetaApi = { size: number; number: number; totalElements: number; totalPages: number; };
export type MembresiaPageResponse = { content: MembresiaData[]; page: PageMetaApi; };

@Injectable({
  providedIn: 'root'
})
export class MembresiaService extends GenericService<MembresiaData> {

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/membresias`)
  }
  

  buscarMembresiasPorSocio(idSocio: number, pagina: number, tamanio: number): Observable<PagedResponse<MembresiaData>>{
    return this.http
      .get(`${this.url}/buscar/socio/${idSocio}?page=${pagina}&size=${tamanio}`)
      .pipe(map((raw: any) => toPagedResponse<MembresiaData>(raw)));
  }

  buscarMembresiasVigentesPorSocio(idSocio: number): Observable<MembresiaData[]>{
    return this.http.get<MembresiaData[]>(`${this.url}/por-socio/${idSocio}/vigentes`);
  }

 /** GET /v1/membresias?page&size&sort=campo,dir */
  listar(opts: { page?: number; size?: number; sort?: string }): Observable<MembresiaPageResponse> {
    const page0 = Math.max(0, (opts.page ?? 1) - 1);
    const params = new HttpParams()
      .set('page', String(page0))
      .set('size', String(opts.size ?? 10))
      .set('sort', String(opts.sort ?? 'fechaInicio,desc'));
    return this.http.get<MembresiaPageResponse>(`${this.url}`, { params });
  }
  
  
}
