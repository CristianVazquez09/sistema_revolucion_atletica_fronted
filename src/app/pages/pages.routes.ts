import { Routes } from '@angular/router';

import { Socio } from './socio/socio';
import { Inscripcion } from './inscripcion/inscripcion';
import { Paquete } from './paquete/paquete';
import { Producto } from './producto/producto';
import { Categoria } from './categoria/categoria';
import { PuntoVenta } from './punto-venta/punto-venta';
import { SocioInformacion } from './socio/socio-informacion/socio-informacion';
import { Reinscripcion } from './reinscripcion/reinscripcion';
import { Asistencia } from './asistencia/asistencia';
import { Historial } from './inscripcion/historial/historial';
import { CorteCaja } from './corte-caja/corte-caja';
import { AgregarMembresia } from './agregar-membresia/agregar-membresia';
import { Administracion } from './administracion/administracion';
import { Entrenador } from './entrenador/entrenador';
import { Asesoria } from './asesoria/asesoria';
import { gerenteGuard } from '../guards/gerente-guards';
import { adminGuard } from '../guards/admin-guards';
import { AsistenciaHistorial } from './inscripcion/asistencia-historial/asistencia-historial';
import { ReinscripcionAdelantada } from './inscripcion/reinscripcion-adelantada/reinscripcion-adelantada';
import { SocioInfoAsesoria } from './socio/socio-info-asesoria/socio-info-asesoria';
import { EntrenadorInfoAsesoria } from './entrenador/entrenador-info-asesoria/entrenador-info-asesoria';

// ✅ NUEVO
import { Inventario } from './inventario/inventario';
import { operacionGuard } from '../guards/operacion-guards';

export const pagesRoutes: Routes = [
  { path: 'paquete', component: Paquete },
  { path: 'asistencia', component: Asistencia },
  { path: 'historial-asistencias', component: AsistenciaHistorial },
  { path: 'reinscripcion-adelantada', component: ReinscripcionAdelantada },
  { path: 'socio', component: Socio },
  { path: 'inscripcion', component: Inscripcion },

  // ✅ Inventario diario (todos los roles autenticados que tengan el menú)
  { path: 'inventario', component: Inventario },

  // ✅ Productos (solo Admin/Gerente)
  { path: 'productos', component: Producto, canMatch: [operacionGuard] },

  { path: 'categoria', component: Categoria },
  { path: 'punto-venta', component: PuntoVenta },
  { path: 'socio/:idSocio/historial', component: SocioInformacion },
  { path: 'reinscripcion/:id', component: Reinscripcion },
  { path: 'historial', component: Historial },
  { path: 'corte-caja', component: CorteCaja },
  { path: 'agregar-membresia', component: AgregarMembresia },
  { path: 'entrenador', component: Entrenador },
  { path: 'asesoria', component: Asesoria },
  { path: 'socio/:idSocio/asesorias', component: SocioInfoAsesoria },
  {
    path: 'entrenador/:idEntrenador/asesorias',
    component: EntrenadorInfoAsesoria,
  },

  {
    path: 'huella',
    loadComponent: () =>
      import('./huella-modal/huella-modal').then((m) => m.HuellaModal),
  },

  { path: 'membresia', redirectTo: 'membresia', pathMatch: 'full' },
  {
    path: 'membresia',
    loadComponent: () =>
      import('./administracion/membresia/membresia').then((m) => m.Membresia),
    data: { title: 'Membresías', scope: 'recepcion' },
  },
  {
    path: 'ventas',
    loadComponent: () =>
      import('./administracion/ventas-admin/ventas-admin').then(
        (m) => m.VentasAdmin,
      ),
    data: { title: 'Ventas', scope: 'recepcion' },
  },

  {
    path: 'admin',
    component: Administracion,
    canMatch: [adminGuard],
    data: {
      sectionTitle: 'Administración',
      allowed: [
        'membresias',
        'cortes',
        'ventas',
        'gimnasios',
        'estadisticas',
        'usuarios',
        'asesoriasNutri',
      ],
    },
    children: [
      {
        path: 'membresias',
        loadComponent: () =>
          import('./administracion/membresia/membresia').then(
            (m) => m.Membresia,
          ),
        data: { title: 'Membresías' },
      },
      {
        path: 'corte-caja',
        loadComponent: () =>
          import('./administracion/corte-caja-admin/corte-caja-admin').then(
            (m) => m.CorteCajaAdmin,
          ),
        data: { title: 'Cortes de caja' },
      },
      {
        path: 'ventas',
        loadComponent: () =>
          import('./administracion/ventas-admin/ventas-admin').then(
            (m) => m.VentasAdmin,
          ),
        data: { title: 'Ventas' },
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./administracion/usuarios-admin/usuarios-admin').then(
            (m) => m.UsuariosAdmin,
          ),
        data: { title: 'Usuarios' },
      },
      {
        path: 'estadisticas',
        loadComponent: () =>
          import('./administracion/reportes/reportes').then((m) => m.Reportes),
        data: { title: 'Reportes' },
      },
      {
        path: 'asesorias-nutricionales',
        loadComponent: () =>
          import('./asesoria-nutricional/asesoria-nutricional').then(
            (m) => m.AsesoriaNutricional,
          ),
        data: { title: 'Asesorías nutricionales' },
      },
    ],
  },

  {
    path: 'gerencia',
    component: Administracion,
    canMatch: [gerenteGuard],
    data: {
      sectionTitle: 'Operación',
      allowed: ['membresias', 'cortes', 'ventas'],
    },
    children: [
      {
        path: 'membresias',
        loadComponent: () =>
          import('./administracion/membresia/membresia').then(
            (m) => m.Membresia,
          ),
        data: { title: 'Membresías' },
      },
      {
        path: 'corte-caja',
        loadComponent: () =>
          import('./administracion/corte-caja-admin/corte-caja-admin').then(
            (m) => m.CorteCajaAdmin,
          ),
        data: { title: 'Cortes de caja' },
      },
      {
        path: 'ventas',
        loadComponent: () =>
          import('./administracion/ventas-admin/ventas-admin').then(
            (m) => m.VentasAdmin,
          ),
        data: { title: 'Ventas' },
      },
    ],
  },
];
