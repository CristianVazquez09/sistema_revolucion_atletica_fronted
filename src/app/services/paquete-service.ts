import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { GenericService } from './generic-service';
import { environment } from '../../environments/environment';
import { PaqueteData } from '../model/paquete-data';

import { PromocionData } from '../model/promocion-data';

@Injectable({
  providedIn: 'root',
})
export class PaqueteService extends GenericService<PaqueteData> {
  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/paquetes`);
  }

  /**
   * ✅ NUEVO
   * GET /v1/paquetes/buscar?nombre=...&activo=true|false
   */
  buscarPorNombre(nombre?: string, activo?: boolean): Observable<PaqueteData[]> {
    let params = new HttpParams();

    const n = (nombre ?? '').trim();
    if (n.length) params = params.set('nombre', n);

    if (activo !== undefined && activo !== null) {
      params = params.set('activo', String(!!activo));
    }

    return this.http.get<PaqueteData[]>(`${this.url}/buscar`, { params });
  }

  /**
   * GET /v1/paquetes/{idPaquete}/promociones?vigentes=true
   * (Lo expone tu PaquetePromocionController)
   */
  buscarPromocionesVigentes(idPaquete: number): Observable<PromocionData[]> {
    const id = Number(idPaquete ?? 0);

    const params = new HttpParams().set('vigentes', 'true');

    return this.http.get<PromocionData[]>(`${this.url}/${id}/promociones`, { params });
  }

  /**
   * Opcional: si alguna pantalla necesita TODAS (vigentes o no).
   */
  buscarPromociones(idPaquete: number, vigentes: boolean = false): Observable<PromocionData[]> {
    const id = Number(idPaquete ?? 0);

    const params = new HttpParams().set('vigentes', String(!!vigentes));

    return this.http.get<PromocionData[]>(`${this.url}/${id}/promociones`, { params });
  }
}
