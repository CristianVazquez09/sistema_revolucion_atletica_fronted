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
import { AgregarMembresia } from './agregar-membresia/agregar-membresia';
import { Administracion } from './administracion/administracion';
import { gerenteGuard } from '../core/auth/gerente-guards';
import { adminGuard } from '../core/auth/admin-guards';
import { AsistenciaHistorial } from './inscripcion/asistencia-historial/asistencia-historial';
import { ReinscripcionAdelantada } from './inscripcion/reinscripcion-adelantada/reinscripcion-adelantada';
import { SocioInfoAsesoria } from './socio/socio-info-asesoria/socio-info-asesoria';

import { operacionGuard } from '../core/auth/operacion-guards';

export const pagesRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  { path: 'paquete', component: Paquete },
  { path: 'asistencia', component: Asistencia },
  { path: 'historial-asistencias', component: AsistenciaHistorial },
  { path: 'reinscripcion-adelantada', component: ReinscripcionAdelantada },
  { path: 'socio', component: Socio },
  { path: 'inscripcion', component: Inscripcion },

  // ✅ Inventario diario (todos los roles autenticados que tengan el menú)
  { path: 'inventario', loadChildren: () => import('../features/inventario/inventario.routes').then(m => m.INVENTARIO_ROUTES) },

  // ✅ Productos (solo Admin/Gerente)
  { path: 'productos', component: Producto, canMatch: [operacionGuard] },

  { path: 'categoria', component: Categoria },
  { path: 'punto-venta', component: PuntoVenta },
  { path: 'socio/:idSocio/historial', component: SocioInformacion },
  { path: 'reinscripcion/:id', component: Reinscripcion },
  { path: 'historial', component: Historial },
  { path: 'corte-caja', loadChildren: () => import('../features/corte-caja/corte-caja.routes').then(m => m.CORTE_CAJA_ROUTES) },
  { path: 'agregar-membresia', component: AgregarMembresia },
  {
    path: 'entrenador',
    loadComponent: () =>
      import('../features/asesorias/pages/entrenador/entrenador').then((m) => m.Entrenador),
  },
  {
    path: 'asesoria',
    loadComponent: () =>
      import('../features/asesorias/pages/asesoria/asesoria').then((m) => m.Asesoria),
  },
  { path: 'socio/:idSocio/asesorias', component: SocioInfoAsesoria },
  {
    path: 'entrenador/:idEntrenador/asesorias',
    loadComponent: () =>
      import('../features/asesorias/pages/entrenador/entrenador-info-asesoria/entrenador-info-asesoria').then(
        (m) => m.EntrenadorInfoAsesoria,
      ),
  },

  {
    path: 'mi-perfil',
    loadComponent: () => import('./mi-perfil/mi-perfil').then((m) => m.MiPerfil),
    data: { title: 'Mi perfil' },
  },

  {
    path: 'huella',
    loadComponent: () =>
      import('../shared/huella/huella-modal/huella-modal').then((m) => m.HuellaModal),
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
        'reportes',
        'usuarios',
        'promociones',
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
          import('./administracion/estadisticas/estadisticas').then((m) => m.Estadisticas),
        data: { title: 'Estadísticas' },
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./administracion/reportes/reportes').then((m) => m.Reportes),
        data: { title: 'Reportes' },
      },
      {
        path: 'asesorias-nutricionales',
        loadComponent: () =>
          import('../features/asesorias/pages/asesoria-nutricional/asesoria-nutricional').then(
            (m) => m.AsesoriaNutricional,
          ),
        data: { title: 'Asesorías nutricionales' },
      },
      {
  path: 'promociones',
  loadComponent: () =>
    import('./administracion/promociones/promociones').then((m) => m.Promociones),
  data: { title: 'Promociones' },
},

    ],
  },

  {
    path: 'gerencia',
    component: Administracion,
    canMatch: [gerenteGuard],
    data: {
      sectionTitle: 'Operación',
      allowed: ['membresias', 'cortes', 'ventas', 'promociones'],
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
    path: 'promociones',
    loadComponent: () => import('./administracion/promociones/promociones').then((m) => m.Promociones),
    data: { title: 'Promociones' },
  },
    ],
  },
];
