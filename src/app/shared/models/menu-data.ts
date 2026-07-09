import { RolData } from "./rol-data";

export interface MenuData{
    idMenu: number;
    icono: string;
    nombre: string;
    url: string;
    roles: RolData[];
}