import { CategoriaData } from "./categoria-data";

export interface ProductoData {
  idProducto?: number;
  nombre: string;
  codigo: string;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  categoria: CategoriaData;
}
