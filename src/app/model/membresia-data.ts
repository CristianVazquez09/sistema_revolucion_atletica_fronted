// src/app/model/membresia-data.ts
import { TipoMovimiento } from '../util/enums/tipo-movimiento';
import { TipoPago } from '../util/enums/tipo-pago ';
import { PaqueteData } from './paquete-data';
import { SocioData } from './socio-data';

export interface MembresiaData {
  idMembresia?: number;          // solo en responses
  socio: SocioData;
  paquete: PaqueteData;
  fechaInicio: string;           // 'YYYY-MM-DD'
  fechaFin: string;              // 'YYYY-MM-DD'
  movimiento: TipoMovimiento;
  tipoPago: TipoPago;
  descuento: number;
  total: number;
}
