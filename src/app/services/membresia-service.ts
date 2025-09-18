import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { MembresiaData } from '../model/membresia-data';
import { PagedResponse, toPagedResponse } from '../model/paged-response';
import { Observable, map } from 'rxjs';

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
  
}
