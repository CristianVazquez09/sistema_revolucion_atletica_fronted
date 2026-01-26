import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { GenericService } from './generic-service';
import { environment } from '../../environments/environment';
import { PaqueteData } from '../model/paquete-data';

// Si ya tienes este archivo, deja este import.
// Si no lo tienes, abajo te dejo un modelo mínimo.
import { PromocionData } from '../model/promocion-data';

@Injectable({
  providedIn: 'root',
})
export class PaqueteService extends GenericService<PaqueteData> {
  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/paquetes`);
  }

  /**
   * GET /v1/paquetes/{idPaquete}/promociones?vigentes=true
   * (Lo expone tu PaquetePromocionController)
   */
  buscarPromocionesVigentes(idPaquete: number): Observable<PromocionData[]> {
    const id = Number(idPaquete ?? 0);

    const params = new HttpParams().set('vigentes', 'true');

    // this.url ya es: {HOST}/paquetes
    // entonces queda: {HOST}/paquetes/{id}/promociones
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
