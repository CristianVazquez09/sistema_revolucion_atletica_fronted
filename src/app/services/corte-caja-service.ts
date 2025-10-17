import { HttpClient, HttpResponse, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GenericService } from './generic-service';
import {
  CorteCajaResponseDTO,
  CerrarCorte,
  CorteCajaListado,
  PagedResponse,
} from '../model/corte-caja-data';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CorteCajaService extends GenericService<CorteCajaResponseDTO> {
  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/cortes`);
  }

  abrir(): Observable<CorteCajaResponseDTO> {
    return this.http.post<CorteCajaResponseDTO>(`${this.url}/abrir`, {});
  }

  cerrar(idCorte: number, req: CerrarCorte): Observable<CorteCajaResponseDTO> {
    return this.http.post<CorteCajaResponseDTO>(
      `${this.url}/${idCorte}/cerrar`,
      req
    );
  }

  consultar(idCorte: number): Observable<CorteCajaResponseDTO> {
    return this.http.get<CorteCajaResponseDTO>(`${this.url}/${idCorte}`);
  }

  consultarAbierto(): Observable<CorteCajaResponseDTO | null> {
    return this.http
      .get<CorteCajaResponseDTO>(`${this.url}/abierto`, { observe: 'response' })
      .pipe(
        map((resp: HttpResponse<CorteCajaResponseDTO>) => resp.body ?? null),
        catchError((err) =>
          err?.status === 404 ? of(null) : throwError(() => err)
        )
      );
  }

  /** Listado paginado de cortes (usa /v1/cortes) */
  listar(opts: {
    estado?: '' | 'ABIERTO' | 'CERRADO'; // el filtro puede venir vacío desde la UI
    page?: number; // UI 1-based, se normaliza adentro
    size?: number;
    sort?: string; // ej. 'apertura,desc'
  }): Observable<PagedResponse<CorteCajaListado>> {
    const page0 = Math.max(0, (opts.page ?? 1) - 1); // 0-based
    const paramsObj: Record<string, string> = {
      page: String(page0),
      size: String(opts.size ?? 10),
    };

    if (opts.sort) paramsObj['sort'] = opts.sort;

    // 🔒 Narrowing estricto: solo mandamos 'ABIERTO' o 'CERRADO'
    const e = opts.estado;
    if (e === 'ABIERTO' || e === 'CERRADO') {
      paramsObj['estado'] = e;
    }

    const params = new HttpParams({ fromObject: paramsObj });
    return this.http.get<PagedResponse<CorteCajaListado>>(
      `${environment.HOST}/cortes`,
      { params }
    );
  }
}
