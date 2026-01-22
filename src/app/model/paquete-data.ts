import { ModalidadPaquete } from "../util/enums/modalidad-paquete";
import { TiempoPlan } from "../util/enums/tiempo-plan";
import { TipoPaquete } from "../util/enums/tipo-paquete";
import { GimnasioData } from "./gimnasio-data";

export interface PaqueteData {
  idPaquete: number;
  nombre: string;
  precio: number;
  tiempo: TiempoPlan;
  costoInscripcion: number;
  gimnasio?: GimnasioData;
  activo: boolean;

  // NUEVO: para planes por visitas (null/undefined => plan por días)
  visitasMaximas?: number | null;

  // (Lo usaremos después; ya está en backend)
  soloFinesDeSemana?: boolean;

  // NUEVO: tipo de paquete (gimnasio, zona de combate, mixto)
  tipoPaquete?: TipoPaquete;

  modalidad?: ModalidadPaquete;

  // ✅ NUEVO: paquete estudiantil
  estudiantil?: boolean;
}
