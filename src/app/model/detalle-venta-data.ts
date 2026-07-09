import { ProductoData } from '../shared/models/producto-data';

export interface DetalleVentaData {
  idDetalle?: number;
  producto: ProductoData;
  cantidad: number;
  subTotal: number;
}
