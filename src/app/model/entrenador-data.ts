import { GimnasioData } from "./gimnasio-data";

export interface EntrenadorData {
    idEntrenador?: number;
    nombre:string;
    apellido:string;
    gimnasio?:GimnasioData;

}