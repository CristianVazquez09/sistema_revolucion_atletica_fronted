import { TiempoPlan } from "../util/enums/tiempo-plan";
import { GimnasioData } from "./gimnasio-data";

export interface PaqueteData {
  idPaquete: number;
  nombre: string;
  precio: number;
  tiempo: TiempoPlan;
  costoInscripcion: number;
  gimnasio?: GimnasioData;
  activo:boolean;
}

