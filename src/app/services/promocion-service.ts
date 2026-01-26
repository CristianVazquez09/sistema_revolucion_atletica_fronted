import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { GenericService } from './generic-service';
import { environment } from '../../environments/environment';
import { PromocionData, PromocionUpsertData } from '../model/promocion-data';

@Injectable({
  providedIn: 'root',
})
export class PromocionService extends GenericService<PromocionData> {
  private readonly host = environment.HOST; // incluye /v1 normalmente

  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/promociones`);
  }

  listar(): Observable<PromocionData[]> {
    return this.buscarTodos();
  }

  crear(payload: PromocionUpsertData): Observable<PromocionData> {
    return this.http.post<PromocionData>(this.url, payload);
  }

  actualizarPromocion(idPromocion: number, payload: PromocionUpsertData): Observable<PromocionData> {
    return this.http.put<PromocionData>(`${this.url}/${idPromocion}`, payload);
  }

  activar(idPromocion: number): Observable<PromocionData> {
    return this.http.patch<PromocionData>(`${this.url}/${idPromocion}/activar`, null);
  }

  desactivar(idPromocion: number): Observable<PromocionData> {
    return this.http.patch<PromocionData>(`${this.url}/${idPromocion}/desactivar`, null);
  }

  // ✅ Backend real:
  // PUT /v1/paquetes/{idPaquete}/promociones/{idPromocion}
  vincularPaquete(idPromocion: number, idPaquete: number): Observable<void> {
    return this.http.put<void>(`${this.host}/paquetes/${idPaquete}/promociones/${idPromocion}`, null);
  }

  // ✅ Backend real:
  // DELETE /v1/paquetes/{idPaquete}/promociones/{idPromocion}
  desvincularPaquete(idPromocion: number, idPaquete: number): Observable<void> {
    return this.http.delete<void>(`${this.host}/paquetes/${idPaquete}/promociones/${idPromocion}`);
  }

  asignarPaquete(idPromocion: number, idPaquete: number): Observable<void> {
    return this.vincularPaquete(idPromocion, idPaquete);
  }



}
