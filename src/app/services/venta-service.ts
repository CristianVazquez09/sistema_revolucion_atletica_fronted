import { Injectable } from '@angular/core';
import { VentaData } from '../model/venta-data';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GenericService } from './generic-service';
import { VentaCreateRequest } from '../model/venta-create';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VentaService extends GenericService<VentaData>{

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/ventas`)

  }

   /** Crea la venta con el payload que espera el backend */
  crearVenta(payload: VentaCreateRequest): Observable<VentaData> {
    return this.http
      .post<VentaData | VentaData[]>(this.url, payload)
      .pipe(
        map((resp) => Array.isArray(resp) ? resp[0] : resp) // tu backend a veces devuelve lista
      );
  }
}
