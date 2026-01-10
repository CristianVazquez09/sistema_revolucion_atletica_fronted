// src/app/services/check-in-service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { MembresiaData } from '../model/membresia-data';
import { SocioData } from '../model/socio-data';
import { AsistenciaHistorialData } from '../model/asistencia-historial-data';
import { PagedResponse, toPagedResponse } from '../model/paged-response';

export interface CheckInRequest {
  idSocio?: number | null;
  idMembresia?: number | null;
}

export interface CheckInResponse {
  autorizado: boolean;
  motivo?: string;
  fecha: string;
  membresia: MembresiaData;
  registroId?: number;
  socio?: SocioData;
}

export interface CheckInHuellaRequest {
  huellaDigital: string;
}

@Injectable({ providedIn: 'root' })
export class CheckInService {
  private readonly http = inject(HttpClient);
  // environment.HOST ya incluye /v1, así que esto pega a /v1/asistencias
  private readonly base = `${environment.HOST}/asistencias`;

  // ─────────── Check-in existentes ───────────

  registrarEntradaPorMembresia(idMembresia: number): Observable<CheckInResponse> {
    const body: CheckInRequest = { idMembresia };
    return this.http.post<CheckInResponse>(`${this.base}/checkin`, body);
  }

  /** NUEVO: check-in por idSocio (POST /v1/asistencias/checkin) */
  registrarEntradaPorSocio(idSocio: number): Observable<CheckInResponse> {
    return this.http.post<CheckInResponse>(`${this.base}/checkin`, { idSocio });
  }

  registrarEntradaPorHuella(huellaDigital: string): Observable<SocioData> {
    const body: CheckInHuellaRequest = { huellaDigital };
    return this.http.post<SocioData>(`${this.base}/checkin/huella`, body);
  }

  // ─────────── Historial global (sin filtros) ───────────

  listarHistorial(
    pagina: number,
    tamanio: number,
    termino?: string | null,
    origen?: 'HUELLA' | 'MANUAL' | null
  ): Observable<PagedResponse<AsistenciaHistorialData>> {

    let params = new HttpParams()
      .set('page', pagina.toString())
      .set('size', tamanio.toString());

    const q = (termino ?? '').trim();
    if (q.length > 0) params = params.set('q', q);
    if (origen) params = params.set('origen', origen);

    return this.http
      .get<any>(this.base, { params })
      .pipe(map(raw => toPagedResponse<AsistenciaHistorialData>(raw)));
  }

  // ─────────── 🔎 NUEVO: historial por rango (y opcional socio) ───────────

  listarHistorialRango(
    pagina: number,
    tamanio: number,
    desde: string,       // 'YYYY-MM-DD'
    hasta: string,       // 'YYYY-MM-DD'
    idSocio?: number | null
  ): Observable<PagedResponse<AsistenciaHistorialData>> {

    let params = new HttpParams()
      .set('page', pagina.toString())
      .set('size', tamanio.toString())
      .set('desde', desde)
      .set('hasta', hasta);

    if (idSocio && idSocio > 0) {
      params = params.set('idSocio', String(idSocio));
    }

    return this.http
      .get<any>(`${this.base}/rango`, { params })
      .pipe(map(raw => toPagedResponse<AsistenciaHistorialData>(raw)));
  }
  // ─────────── 🔎 NUEVO: buscar historial por nombre de socio ───────────
// GET /v1/asistencias/buscar?nombre=...&page=...&size=...
buscarPorNombreSocio(
  pagina: number,
  tamanio: number,
  nombre: string
): Observable<PagedResponse<AsistenciaHistorialData>> {

  const n = (nombre ?? '').trim();

  let params = new HttpParams()
    .set('page', pagina.toString())
    .set('size', tamanio.toString())
    .set('nombre', n);

  return this.http
    .get<any>(`${this.base}/buscar`, { params })
    .pipe(map(raw => toPagedResponse<AsistenciaHistorialData>(raw)));
}

// ✅ NUEVO: filtros combinables (desde/hasta/nombre) -> GET {base}/buscar
buscar(
  pagina: number,
  tamanio: number,
  desde?: string | null,
  hasta?: string | null,
  nombre?: string | null
): Observable<PagedResponse<AsistenciaHistorialData>> {

  const n = (nombre ?? '').trim();

  let params = new HttpParams()
    .set('page', String(pagina))
    .set('size', String(tamanio));

  // solo mandamos fechas si vienen ambas (evita 400/IllegalArgumentException)
  if (desde && hasta) {
    params = params.set('desde', desde).set('hasta', hasta);
  }

  // solo mandamos nombre si trae contenido
  if (n.length > 0) {
    params = params.set('nombre', n);
  }

  return this.http
    .get<any>(`${this.base}/buscar`, { params })
    .pipe(map(raw => toPagedResponse<AsistenciaHistorialData>(raw)));
}


}
