import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { InventarioDiarioProductoData, TurnoInventario } from '../model/inventario-diario-data';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private base = `${environment.HOST}/inventario`;

  constructor(private http: HttpClient) {}

  diario(opts: {
    fecha: string;                 // YYYY-MM-DD
    turno: TurnoInventario;        // MANANA|TARDE|UNICO
    gimnasioId?: number | null;    // solo admin
  }): Observable<InventarioDiarioProductoData[]> {
    let params = new HttpParams()
      .set('fecha', opts.fecha)
      .set('turno', opts.turno);

    if (opts.gimnasioId != null) {
      params = params.set('gimnasioId', String(opts.gimnasioId));
    }

    return this.http.get<InventarioDiarioProductoData[]>(`${this.base}/diario`, { params });
  }
}
