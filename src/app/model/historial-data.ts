import { TipoMovimiento } from "../util/enums/tipo-movimiento";
import { TipoPago } from "../util/enums/tipo-pago";

export interface HistorialData{
    idMembresia:number;
    fechaInicio:string;
    fechaFin: string;
    movimiento: TipoMovimiento;
    tipoPago: TipoPago;
    paqueteNombre: string;
    socioNombreCompleto:string;
    descuento:number;
    total:number;
}