import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AsesoriaNutricionalData,
  AsesoriaNutricionalUpsertDTO,
  AsesoriaNutricionalVigenciaDTO,
} from '../model/asesoria-nutricional-data';

/** ✅ Nuevo DTO para /estado/{idSocio} */
export type AsesoriaNutricionalEstadoDTO = {
  asesorado: boolean;
  vigente: boolean;
  activo: boolean;
  estado: 'SIN_ASESORIA' | 'DESACTIVADA' | 'PROGRAMADA' | 'VIGENTE' | 'VENCIDA';
  fechaInicio: string | null; // LocalDate -> "YYYY-MM-DD"
  fechaFin: string | null;    // LocalDate -> "YYYY-MM-DD"
  idAsesoriaNutricional: number | null;
};

@Injectable({ providedIn: 'root' })
export class AsesoriaNutricionalService {
  private http = inject(HttpClient);

  private baseUrl(): string {
    // Si tu controller es @RequestMapping("v1/asesorias-nutricionales")
    // Asegúrate que environment.HOST ya incluya /v1
    return `${environment.HOST}/asesorias-nutricionales`;
  }

  buscarTodos(): Observable<AsesoriaNutricionalData[]> {
    return this.http.get<AsesoriaNutricionalData[]>(this.baseUrl());
  }

  buscarPorId(id: number): Observable<AsesoriaNutricionalData> {
    return this.http.get<AsesoriaNutricionalData>(`${this.baseUrl()}/${id}`);
  }

  crear(dto: AsesoriaNutricionalUpsertDTO): Observable<AsesoriaNutricionalData> {
    return this.http.post<AsesoriaNutricionalData>(this.baseUrl(), dto);
  }

  renovar(id: number, dto: AsesoriaNutricionalUpsertDTO): Observable<AsesoriaNutricionalData> {
    return this.http.put<AsesoriaNutricionalData>(`${this.baseUrl()}/${id}`, dto);
  }

  desactivar(id: number): Observable<AsesoriaNutricionalData> {
    return this.http.patch<AsesoriaNutricionalData>(`${this.baseUrl()}/${id}/desactivar`, {});
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl()}/${id}`);
  }

  vigente(idSocio: number): Observable<AsesoriaNutricionalVigenciaDTO> {
    return this.http.get<AsesoriaNutricionalVigenciaDTO>(`${this.baseUrl()}/vigente/${idSocio}`);
  }

  /** ✅ Nuevo endpoint: /estado/{idSocio} */
  estado(idSocio: number): Observable<AsesoriaNutricionalEstadoDTO> {
    return this.http.get<AsesoriaNutricionalEstadoDTO>(`${this.baseUrl()}/estado/${idSocio}`);
  }
}
