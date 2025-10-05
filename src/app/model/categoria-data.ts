import { GimnasioData } from "./gimnasio-data";

export interface CategoriaData {
  idCategoria?: number;
  nombre: string;

  gimnasio?: GimnasioData
}
