import { GimnasioData } from "./gimnasio-data";

export interface EntrenadorData {
    idEntrenador?: number;
    nombre:string;
    apellido:string;
    activo:boolean
    gimnasio?:GimnasioData;

}