import { Injectable } from '@angular/core';
import { VentaData } from '../model/venta-data';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GenericService } from './generic-service';
import { VentaCreateRequest } from '../model/venta-create';
import { map, Observable } from 'rxjs';

export type PageMeta = { size: number; number: number; totalElements: number; totalPages: number; };
export interface VentaPageResponse { content: VentaData[]; page: PageMeta; }

@Injectable({
  providedIn: 'root'
})
export class VentaService extends GenericService<VentaData>{

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/ventas`)

  }

   /** Crea la venta con el payload que espera el backend */
  crearVenta(payload: VentaCreateRequest): Observable<VentaData> {
    return this.http
      .post<VentaData | VentaData[]>(this.url, payload)
      .pipe(
        map((resp) => Array.isArray(resp) ? resp[0] : resp) // tu backend a veces devuelve lista
      );
  }

  /** Listado paginado: /v1/ventas?page=&size=&sort= */
  listar(opts: { page?: number; size?: number; sort?: string; }): Observable<VentaPageResponse> {
    const page0 = Math.max(0, (opts.page ?? 1) - 1);
    const paramsObj: Record<string, string> = {
      page: String(page0),
      size: String(opts.size ?? 10),
    };
    if (opts.sort) paramsObj['sort'] = opts.sort;

    const params = new HttpParams({ fromObject: paramsObj });
    return this.http.get<VentaPageResponse>(this.url, { params });
  }
}
