import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';

import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { MembresiaData } from '../model/membresia-data';
import { PagedResponse, toPagedResponse } from '../model/paged-response';
import { Observable, map } from 'rxjs';
import { MembresiaPatchRequest } from '../model/membresia-patch';

type PageMetaApi = { size: number; number: number; totalElements: number; totalPages: number; };
export type MembresiaPageResponse = { content: MembresiaData[]; page: PageMetaApi; };
export type MembresiaBatchRequestDTO = {
  membresias: any[]; // request flexible (puede ser parcial)
};

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

  patch(id: number, body: MembresiaPatchRequest): Observable<MembresiaData> {
    return this.http.patch<MembresiaData>(`${this.url}/${id}`, body);
  }

  // ===================== NUEVO: buscar por folio =====================

  buscarPorFolio(folio: number): Observable<MembresiaData> {
    return this.http.get<MembresiaData>(`${this.url}/folio/${folio}`);
  }

  // ========== NUEVO: buscar por nombre de socio (paginado) ==========

  buscarPorNombreSocio(q: string, opts: { page?: number; size?: number; sort?: string }): Observable<MembresiaPageResponse> {
    const page0 = Math.max(0, (opts.page ?? 1) - 1);
    let params = new HttpParams()
      .set('q', q)
      .set('page', String(page0))
      .set('size', String(opts.size ?? 10))
      .set('sort', String(opts.sort ?? 'fechaInicio,desc'));

    return this.http.get<MembresiaPageResponse>(`${this.url}/buscar/socio-nombre`, { params });
  }

  // ========== NUEVO: listar por rango de fechas ==========

  /** GET /v1/membresias/rango?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&page&size&sort */
  listarPorRango(desde: string, hasta: string, opts: { page?: number; size?: number; sort?: string }): Observable<MembresiaPageResponse> {
    const page0 = Math.max(0, (opts.page ?? 1) - 1);

    const paramsObj: Record<string, string> = {
      desde,
      hasta,
      page: String(page0),
      size: String(opts.size ?? 10),
    };
    if (opts.sort) paramsObj['sort'] = opts.sort;

    const params = new HttpParams({ fromObject: paramsObj });
    return this.http.get<MembresiaPageResponse>(`${this.url}/rango`, { params });
  }
    // ========== NUEVO: reinscripción anticipada ==========
  /** POST /v1/membresias/reinscripcion/anticipada */
  reinscripcionAnticipada(payload: Partial<MembresiaData>): Observable<MembresiaData> {
    return this.http.post<MembresiaData>(`${this.url}/reinscripcion/anticipada`, payload);
  }

   /**
   * ✅ Batch general: sirve para INSCRIPCION o REINSCRIPCION.
   * Backend valida que todas traigan el mismo paquete (modalidad).
   */
  guardarBatch(membresias: any[]): Observable<MembresiaData[]> {
    const body: MembresiaBatchRequestDTO = { membresias };
    return this.http.post<MembresiaData[]>(`${this.url}/batch`, body);
  }

  /**
   * ✅ Batch reinscripción anticipada.
   */
  reinscripcionAnticipadaBatch(membresias: any[]): Observable<MembresiaData[]> {
    const body: MembresiaBatchRequestDTO = { membresias };
    return this.http.post<MembresiaData[]>(`${this.url}/batch/reinscripcion/anticipada`, body);
  }

}
