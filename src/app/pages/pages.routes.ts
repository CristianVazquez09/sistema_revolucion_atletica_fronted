import { Routes } from "@angular/router";

import { Socio } from "./socio/socio";
import { Inscripcion } from "./inscripcion/inscripcion";
import { Paquete } from "./paquete/paquete";
import { Producto } from "./producto/producto";
import { Categoria } from "./categoria/categoria";
import { PuntoVenta } from "./punto-venta/punto-venta";
import { SocioInformacion } from "./socio/socio-informacion/socio-informacion";
import { Reinscripcion } from "./reinscripcion/reinscripcion";
import { Asistencia } from "./asistencia/asistencia";
import { Historial } from "./inscripcion/historial/historial";

export const pagesRoutes: Routes = [
  { path: 'paquete', component: Paquete},
  {path: 'asistencia', component: Asistencia},
  {path: 'socio', component: Socio},
  {path: 'inscripcion', component: Inscripcion},
  {path: 'inventario', component: Producto},
  {path: 'categoria', component: Categoria},
  {path: 'punto-venta', component: PuntoVenta},
   { path: 'socio/:idSocio/historial', component: SocioInformacion },
   { path: 'reinscripcion/:id', component: Reinscripcion },
  { path: 'historial', component: Historial },


];