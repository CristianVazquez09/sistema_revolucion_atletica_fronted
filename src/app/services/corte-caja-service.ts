import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { GenericService } from './generic-service';
import { CorteCajaResponseDTO, CerrarCorte } from '../model/corte-caja-data';

@Injectable({ providedIn: 'root' })
export class CorteCajaService extends GenericService<CorteCajaResponseDTO> {

  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/cortes`);
  }

  abrir(): Observable<CorteCajaResponseDTO> {
    return this.http.post<CorteCajaResponseDTO>(`${this.url}/abrir`, {});
  }

  cerrar(idCorte: number, req: CerrarCorte): Observable<CorteCajaResponseDTO> {
    return this.http.post<CorteCajaResponseDTO>(`${this.url}/${idCorte}/cerrar`, req);
  }

  consultar(idCorte: number): Observable<CorteCajaResponseDTO> {
    return this.http.get<CorteCajaResponseDTO>(`${this.url}/${idCorte}`);
  }

  /**
   * Devuelve el corte abierto del gimnasio actual o null si no hay.
   * - 200: body con corte
   * - 204: sin contenido -> null
   * - 404: no hay corte abierto -> null
   */
  consultarAbierto(): Observable<CorteCajaResponseDTO | null> {
    return this.http
      .get<CorteCajaResponseDTO>(`${this.url}/abierto`, { observe: 'response' })
      .pipe(
        map((resp: HttpResponse<CorteCajaResponseDTO>) => resp.body ?? null),
        catchError(err => {
          if (err?.status === 404) return of(null);
          return throwError(() => err);
        })
      );
  }
}
