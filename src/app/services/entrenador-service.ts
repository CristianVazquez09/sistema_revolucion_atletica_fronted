// src/app/services/entrenador-service.ts
import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';
import { EntrenadorData } from '../model/entrenador-data';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { AsesoriaContratoData } from '../model/asesoria-contrato-data';

@Injectable({
  providedIn: 'root'
})
export class EntrenadorService extends GenericService<EntrenadorData> {

  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/entrenadores`);
  }

  // 🔹 Asesorías personalizadas activas para un entrenador
  listarAsesoriasActivas(idEntrenador: number): Observable<AsesoriaContratoData[]> {
    return this.http.get<AsesoriaContratoData[]>(
      `${this.url}/${idEntrenador}/asesorias-activas`
    );
  }
}
