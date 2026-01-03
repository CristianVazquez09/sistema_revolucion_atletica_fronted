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
  AbrirCorte,
  CorteCajaPreviewDTO,
  RegistrarSalidaEfectivoRequest,
  SalidaEfectivo,
} from '../model/corte-caja-data';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CorteCajaService extends GenericService<CorteCajaResponseDTO> {
  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/cortes`);
  }

  // === Abrir con fondo ===
  abrir(req: AbrirCorte): Observable<CorteCajaResponseDTO> {
  const body = { fondoCajaInicial: Number(req?.fondoCajaInicial ?? 0) }; // 👈 fuerza number
  return this.http.post<CorteCajaResponseDTO>(`${this.url}/abrir`, body, {
    headers: { 'Content-Type': 'application/json' } // explícito por si acaso
  });
}


  cerrar(idCorte: number, req: CerrarCorte): Observable<CorteCajaResponseDTO> {
    return this.http.post<CorteCajaResponseDTO>(`${this.url}/${idCorte}/cerrar`, req);
  }

  consultar(idCorte: number): Observable<CorteCajaResponseDTO> {
    return this.http.get<CorteCajaResponseDTO>(`${this.url}/${idCorte}`);
  }

  consultarAbierto(): Observable<CorteCajaResponseDTO | null> {
    return this.http
      .get<CorteCajaResponseDTO>(`${this.url}/abierto`, { observe: 'response' })
      .pipe(
        map((resp: HttpResponse<CorteCajaResponseDTO>) => resp.body ?? null),
        catchError((err) => (err?.status === 404 ? of(null) : throwError(() => err)))
      );
  }

  // === Preview en vivo (por id o el abierto actual) ===
  previsualizar(idCorte: number, hasta?: string): Observable<CorteCajaPreviewDTO> {
    let params = new HttpParams();
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<CorteCajaPreviewDTO>(`${this.url}/${idCorte}/preview`, { params });
  }

  previsualizarAbierto(hasta?: string): Observable<CorteCajaPreviewDTO> {
    let params = new HttpParams();
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<CorteCajaPreviewDTO>(`${this.url}/abierto/preview`, { params });
  }

  // === Salidas de efectivo ===
  registrarSalida(idCorte: number, req: RegistrarSalidaEfectivoRequest): Observable<SalidaEfectivo> {
    return this.http.post<SalidaEfectivo>(`${this.url}/${idCorte}/salidas`, req);
  }
  listarSalidas(idCorte: number): Observable<SalidaEfectivo[]> {
    return this.http.get<SalidaEfectivo[]>(`${this.url}/${idCorte}/salidas`);
  }

  /** Listado paginado */
  listar(opts: {
    estado?: '' | 'ABIERTO' | 'CERRADO';
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<PagedResponse<CorteCajaListado>> {
    const page0 = Math.max(0, (opts.page ?? 1) - 1);
    const paramsObj: Record<string, string> = {
      page: String(page0),
      size: String(opts.size ?? 10),
    };
    if (opts.sort) paramsObj['sort'] = opts.sort;
    const e = opts.estado;
    if (e === 'ABIERTO' || e === 'CERRADO') paramsObj['estado'] = e;

    const params = new HttpParams({ fromObject: paramsObj });
    return this.http.get<PagedResponse<CorteCajaListado>>(`${this.url}`, { params });
  }
}
