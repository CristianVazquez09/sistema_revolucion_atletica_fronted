import { CategoriaData } from "./categoria-data";
import { GimnasioData } from "./gimnasio-data";

export interface ProductoData {
  idProducto?: number;
  nombre: string;
  codigo: string;
  precioCompra: number;
  precioVenta: number;
  cantidad: number;
  categoria: CategoriaData;
  activo:boolean;
  gimnasio?: GimnasioData;
  
}
