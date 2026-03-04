// src/app/services/estadisticas-service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IngresosDia {
  fecha: string;
  membresias: number;
  ventas: number;
  asesorias: number;
  total: number;
}

export interface DashboardFinancieras {
  ingresosMembresias: number;
  ingresosVentas: number;
  ingresosAsesorias: number;
  ingresoTotal: number;
  ingresosPorDia: IngresosDia[];
}

export interface DashboardSocios {
  totalActivos: number;
  conMembresia: number;
  sinMembresia: number;
  nuevosEnPeriodo: number;
  distribucionEdades?: Array<{ edad: number; cantidad: number }>;
  porGenero: { masculino: number; femenino: number };
}

export interface DashboardMembresias {
  activasHoy: number;
  nuevasEnPeriodo: number;
  porVencer7dias: number;
  porVencer15dias: number;
  porVencer30dias: number;
  activasPorTipoPaquete?: Array<{ tipoPaquete: string; cantidad: number }>;
  paquetesMasVendidosEnPeriodo?: Array<{ nombre: string; tipoPaquete: string; cantidad: number }>;
  paquetesMenosVendidosEnPeriodo?: Array<{ nombre: string; tipoPaquete: string; cantidad: number }>;
}

export interface AsistenciasDia {
  fecha: string;
  cantidad: number;
}

export interface DashboardAsistencias {
  totalEnPeriodo: number;
  asistenciasPorDia?: AsistenciasDia[];
}

export interface DashboardInventario {
  topProductos?: Array<{ idProducto: number; nombre: string; cantidadVendida: number; totalIngreso: number }>;
  productosMasVendidos?: Array<{ idProducto: number; nombre: string; cantidadVendida: number; totalIngreso: number }>;
  bajoStock?: Array<{ nombre: string; stock: number }>;
  productosMenosVendidos?: Array<{ idProducto: number; nombre: string; cantidadVendida: number; totalIngreso: number }>;
}

export interface EntrenadorRanking {
  idEntrenador: number;
  nombre: string;
  apellido: string;
  totalEnPeriodo: number;
  asesoriasActivas: number;
}

export interface DashboardEntrenadores {
  ranking: EntrenadorRanking[];
}

export interface DashboardResponse {
  financieras: DashboardFinancieras;
  socios: DashboardSocios;
  membresias: DashboardMembresias;
  asistencias: DashboardAsistencias;
  inventario: DashboardInventario;
  entrenadores?: DashboardEntrenadores;
}

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private baseUrl = environment.HOST;

  constructor(private http: HttpClient) {}

  getDashboard(
    idGimnasio: number | null,
    desde: string,
    hasta: string
  ): Observable<DashboardResponse> {
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (idGimnasio != null) {
      params = params.set('idGimnasio', idGimnasio);
    }
    return this.http.get<DashboardResponse>(
      `${this.baseUrl}/estadisticas/dashboard`,
      { params }
    );
  }
}
