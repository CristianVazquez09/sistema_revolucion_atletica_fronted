import { ModalidadPaquete } from "../shared/util/enums/modalidad-paquete";
import { TiempoPlan } from "../shared/util/enums/tiempo-plan";
import { TipoPaquete } from "../shared/util/enums/tipo-paquete";
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

  // paquete estudiantil
  estudiantil?: boolean;

  // paquete Revolución Atlética (requiere entrenador RA en inscripción)
  esRA?: boolean;
}
