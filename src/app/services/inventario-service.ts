import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  InventarioTurnoResponseData,
  InventarioCierreRequestData,
  InventarioCierreResultadoData,
  TurnoInventario
} from '../model/inventario-diario-data';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  // Si tu HOST ya trae /v1, deja: `${environment.HOST}/inventario`
  private base = `${environment.HOST}/inventario`;

  constructor(private http: HttpClient) {}

  turno(opts: {
    fecha: string;              // YYYY-MM-DD
    turno: TurnoInventario;     // MANANA|TARDE|UNICO
    gimnasioId?: number | null; // opcional (si tu backend lo usa)
  }): Observable<InventarioTurnoResponseData> {
    let params = new HttpParams()
      .set('fecha', opts.fecha)
      .set('turno', opts.turno);

    if (opts.gimnasioId != null) {
      params = params.set('gimnasioId', String(opts.gimnasioId));
    }

    return this.http.get<InventarioTurnoResponseData>(`${this.base}/turno`, { params });
  }

  cerrar(payload: InventarioCierreRequestData): Observable<InventarioCierreResultadoData> {
    return this.http.post<InventarioCierreResultadoData>(`${this.base}/cerrar`, payload);
  }
}
