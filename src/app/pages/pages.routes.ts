import { Routes } from '@angular/router';

import { Paquete } from './paquete/paquete';
import { Producto } from './producto/producto';
import { Categoria } from './categoria/categoria';
import { Administracion } from './administracion/administracion';
import { gerenteGuard } from '../core/auth/gerente-guards';
import { adminGuard } from '../core/auth/admin-guards';

import { operacionGuard } from '../core/auth/operacion-guards';

export const pagesRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home/home').then((m) => m.Home),
  },
  { path: 'paquete', component: Paquete },
  {
    path: 'asistencia',
    loadComponent: () => import('../features/asistencia/pages/asistencia/asistencia').then((m) => m.Asistencia),
  },
  {
    path: 'historial-asistencias',
    loadComponent: () => import('../features/asistencia/pages/asistencia-historial/asistencia-historial').then((m) => m.AsistenciaHistorial),
  },
  {
    path: 'reinscripcion-adelantada',
    loadComponent: () =>
      import('../features/inscripciones/pages/inscripcion/reinscripcion-adelantada/reinscripcion-adelantada').then(
        (m) => m.ReinscripcionAdelantada,
      ),
  },
  {
    path: 'socio',
    loadComponent: () => import('../features/socios/pages/socio/socio').then((m) => m.Socio),
  },
  {
    path: 'inscripcion',
    loadComponent: () =>
      import('../features/inscripciones/pages/inscripcion/inscripcion').then((m) => m.Inscripcion),
  },

  // ✅ Inventario diario (todos los roles autenticados que tengan el menú)
  { path: 'inventario', loadChildren: () => import('../features/inventario/inventario.routes').then(m => m.INVENTARIO_ROUTES) },

  // ✅ Productos (solo Admin/Gerente)
  { path: 'productos', component: Producto, canMatch: [operacionGuard] },

  { path: 'categoria', component: Categoria },
  {
    path: 'punto-venta',
    loadComponent: () =>
      import('../features/punto-venta/pages/punto-venta/punto-venta').then(
        (m) => m.PuntoVenta,
      ),
  },
  {
    path: 'socio/:idSocio/historial',
    loadComponent: () =>
      import('../features/socios/pages/socio/socio-informacion/socio-informacion').then(
        (m) => m.SocioInformacion,
      ),
  },
  {
    path: 'reinscripcion/:id',
    loadComponent: () =>
      import('../features/inscripciones/pages/reinscripcion/reinscripcion').then((m) => m.Reinscripcion),
  },
  {
    path: 'historial',
    loadComponent: () =>
      import('../features/inscripciones/pages/inscripcion/historial/historial').then((m) => m.Historial),
  },
  { path: 'corte-caja', loadChildren: () => import('../features/corte-caja/corte-caja.routes').then(m => m.CORTE_CAJA_ROUTES) },
  {
    path: 'agregar-membresia',
    loadComponent: () =>
      import('../features/inscripciones/pages/agregar-membresia/agregar-membresia').then(
        (m) => m.AgregarMembresia,
      ),
  },
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
  {
    path: 'socio/:idSocio/asesorias',
    loadComponent: () =>
      import('../features/socios/pages/socio/socio-info-asesoria/socio-info-asesoria').then(
        (m) => m.SocioInfoAsesoria,
      ),
  },
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
