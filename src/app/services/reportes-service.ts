// src/app/services/reportes.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GimnasioData } from '../model/gimnasio-data';

@Injectable({ providedIn: 'root' })
export class ReportesService {
  // environment.HOST ya trae el /v1
  private baseUrl = environment.HOST;

  constructor(private http: HttpClient) {}

  /** Lista TODOS los gimnasios (admin) usando tu endpoint existente /v1/gimnasios */
  listarGimnasios(): Observable<GimnasioData[]> {
    return this.http.get<GimnasioData[]>(`${this.baseUrl}/gimnasios`);
  }

  /** Descarga Excel de movimientos (con o sin idGimnasio) */
  descargarExcelMovimientos(
    idGimnasio: number | null,
    desde: string,
    hasta: string
  ): Observable<Blob> {
    let params = new HttpParams()
      .set('desde', desde)
      .set('hasta', hasta);

    if (idGimnasio != null) {
      params = params.set('idGimnasio', idGimnasio);
    }

    console.log('[ReportesService] GET', `${this.baseUrl}/reportes/movimientos/excel`, params.toString());

    return this.http.get(`${this.baseUrl}/reportes/movimientos/excel`, {
      params,
      responseType: 'blob'
    });
  }
}
