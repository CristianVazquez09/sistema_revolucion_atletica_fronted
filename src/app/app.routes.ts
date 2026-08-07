import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./features/cuenta/pages/login/login').then((m) => m.Login),
  },
  {
    path: 'pages',
    loadComponent: () =>
      import('./features/cuenta/pages/menu-principal/menu-principal').then((m) => m.MenuPrincipal),
    loadChildren: () =>
      import('./pages/pages.routes').then((x) => x.pagesRoutes),
  },
];
