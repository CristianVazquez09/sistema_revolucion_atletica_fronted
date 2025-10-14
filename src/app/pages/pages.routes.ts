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
import { CorteCaja } from "./corte-caja/corte-caja";
import { AgregarMembresia } from "./agregar-membresia/agregar-membresia";
import { Administracion } from "./administracion/administracion";
import { Entrenador } from "./entrenador/entrenador";
import { Accesoria } from "./accesoria/accesoria";

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
  { path: 'corte-caja', component: CorteCaja }, 
  { path: 'agregar-membresia', component: AgregarMembresia },
  { path: 'entrenador', component: Entrenador },
  { path: 'accesoria', component: Accesoria },
  {
    path: 'admin',
    component: Administracion,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'membresias' },
      {
        path: 'membresias',
        loadComponent: () =>
          import('./administracion/membresia/membresia')
            .then(m => m.Membresia)
      },
      // cuando quieras agregar más:
      // { path: 'socios', loadComponent: () => import('./administracion/socios/admin-socios').then(m => m.AdminSocios) },
      // { path: 'corte-caja', loadComponent: () => import('./administracion/corte/admin-corte').then(m => m.AdminCorte) },
      // { path: 'estadisticas', loadComponent: () => import('./administracion/estadisticas/admin-estadisticas').then(m => m.AdminEstadisticas) },
      // { path: 'informes', loadComponent: () => import('./administracion/informes/admin-informes').then(m => m.AdminInformes) },
    ]
  }


];