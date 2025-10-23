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
import { Asesoria } from "./asesoria/asesoria";
import { gerenteGuard } from "../guards/gerente-guards";
import { adminGuard } from "../guards/admin-guards";

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
  { path: 'asesoria', component: Asesoria },
 
// pages.routes.ts
{
  path: 'admin',
  component: Administracion,
  canMatch: [adminGuard],
  data: {
    sectionTitle: 'Administración',
    allowed: ['membresias','cortes','ventas','gimnasios','estadisticas','usuarios']
  },
  children: [
    // NO redirectTo aquí para ver el grid
    { path: 'membresias', loadComponent: () => import('./administracion/membresia/membresia').then(m => m.Membresia), data: { title: 'Membresías' } },
    { path: 'corte-caja', loadComponent: () => import('./administracion/corte-caja-admin/corte-caja-admin').then(m => m.CorteCajaAdmin), data: { title: 'Cortes de caja' } },
    { path: 'ventas',     loadComponent: () => import('./administracion/ventas-admin/ventas-admin').then(m => m.VentasAdmin), data: { title: 'Ventas' } },
    { path: 'usuarios',     loadComponent: () => import('./administracion/usuarios-admin/usuarios-admin').then(m => m.UsuariosAdmin), data: { title: 'Usuarios' } },
  ]
},
{
  path: 'gerencia',
  component: Administracion,
  canMatch: [gerenteGuard],
  data: {
    sectionTitle: 'Operación', // o “Gerencia”
    allowed: ['membresias','cortes','ventas']
  },
  children: [
    // SIN redirectTo aquí también
    { path: 'membresias', loadComponent: () => import('./administracion/membresia/membresia').then(m => m.Membresia), data: { title: 'Membresías' } },
    { path: 'corte-caja', loadComponent: () => import('./administracion/corte-caja-admin/corte-caja-admin').then(m => m.CorteCajaAdmin), data: { title: 'Cortes de caja' } },
    { path: 'ventas',     loadComponent: () => import('./administracion/ventas-admin/ventas-admin').then(m => m.VentasAdmin), data: { title: 'Ventas' } },
    
  ]
}


];