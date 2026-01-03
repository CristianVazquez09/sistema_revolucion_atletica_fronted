// src/app/services/socio-service.ts
import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';
import { SocioData } from '../model/socio-data';
import { PagedResponse, toPagedResponse } from '../model/paged-response';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, map } from 'rxjs';
import { MembresiaData } from '../model/membresia-data';
import { AsesoriaContratoData } from '../model/asesoria-contrato-data';
import { TipoPaquete } from '../util/enums/tipo-paquete'; // 👈 enum de tipo de paquete

@Injectable({
  providedIn: 'root'
})
export class SocioService extends GenericService<SocioData> {

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/socios`);
  }

  /** Listado paginado general, con filtros opcionales:
   *  - tipoPaquete (membresía vigente)
   *  - activo (true / false)
   */
  buscarSocios(
    pagina: number,
    tamanio: number,
    tipoPaquete?: TipoPaquete | null,
    activo?: boolean | null
  ): Observable<PagedResponse<SocioData>> {

    const params: string[] = [
      `page=${pagina}`,
      `size=${tamanio}`
    ];

    if (tipoPaquete) {
      params.push(`tipoPaquete=${encodeURIComponent(tipoPaquete)}`);
    }
    if (typeof activo === 'boolean') {
      params.push(`activo=${activo}`); // se envía ?activo=true/false
    }

    const url = `${this.url}/buscar?${params.join('&')}`;

    return this.http
      .get(url)
      .pipe(map((raw: any) => toPagedResponse<SocioData>(raw)));
  }

  /** Listado paginado filtrando por nombre,
   *  con filtro opcional de estado (activo/inactivo)
   */
  buscarSociosPorNombre(
    nombre: string,
    pagina: number,
    tamanio: number,
    activo?: boolean | null,
    tipoPaquete?: TipoPaquete | null,
    soloVigentes?: boolean | null
  ): Observable<PagedResponse<SocioData>> {
    const params: string[] = [
      `page=${pagina}`,
      `size=${tamanio}`,
      `nombre=${encodeURIComponent((nombre ?? '').trim())}`
    ];
    if (typeof activo === 'boolean') {
      params.push(`activo=${activo}`);
    }
    if (tipoPaquete) {
      params.push(`tipoPaquete=${encodeURIComponent(tipoPaquete)}`);
    }
    if (typeof soloVigentes === 'boolean') {
      params.push(`soloVigentes=${soloVigentes}`);
    }

    const url = `${this.url}/buscar?${params.join('&')}`;
    return this.http.get(url).pipe(map((raw: any) => toPagedResponse<SocioData>(raw)));
  }

  obtenerAsesoriasDeSocio(
    idSocio: number,
    pagina: number,
    tamanio: number
  ): Observable<PagedResponse<AsesoriaContratoData>> {
    const url = `${environment.HOST}/socios/${idSocio}/asesorias?page=${pagina}&size=${tamanio}`;
    return this.http
      .get<any>(url)
      .pipe(map(raw => toPagedResponse<AsesoriaContratoData>(raw)));
  }

  buscarPorHuella(huellaDigital: string): Observable<SocioData> {
    const body = { huellaDigital: this.limpiarBase64(huellaDigital) };
    return this.http.post<SocioData>(`${this.url}/buscar-por-huella`, body);
  }

  /** Registrar huella para un socio (POST /v1/socios/{idSocio}/huella) */
  registrarHuella(idSocio: number, huellaBase64: string): Observable<SocioData> {
    const body = { huellaBase64: this.limpiarBase64(huellaBase64) };
    return this.http.post<SocioData>(`${this.url}/${idSocio}/huella`, body);
  }

  /** Actualizar / reemplazar huella (PUT /v1/socios/{idSocio}/huella) */
  actualizarHuella(idSocio: number, huellaBase64: string): Observable<SocioData> {
    const body = { huellaBase64: this.limpiarBase64(huellaBase64) };
    return this.http.put<SocioData>(`${this.url}/${idSocio}/huella`, body);
  }

  /** Quita encabezado DataURL y espacios en blanco para que coincida con lo guardado (iVBORw0...). */
  private limpiarBase64(s: string): string {
    const raw = (s ?? '').trim();
    const i = raw.indexOf(',');
    return i >= 0 ? raw.slice(i + 1).trim() : raw;
  }
}
