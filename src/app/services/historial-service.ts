// src/app/services/historial-service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { PagedResponse, toPagedResponse } from '../model/paged-response';
import { HistorialData } from '../model/historial-data';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HistorialService {
  private url = `${environment.HOST}/historial`;

  constructor(private http: HttpClient) {}

  consultar(pagina: number, tamanio: number): Observable<PagedResponse<HistorialData>>{
    const params = new HttpParams()
      .set('page', String(pagina))
      .set('size', String(tamanio));

    return this.http
      .get(this.url, { params })
      .pipe(map((raw: any) => toPagedResponse<HistorialData>(raw)));
  }
}
