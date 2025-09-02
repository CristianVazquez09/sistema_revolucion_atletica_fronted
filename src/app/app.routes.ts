import { Routes } from '@angular/router';
import { MenuPrincipal } from './pages/menu-principal/menu-principal';
import { Login } from './login/login';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: Login },
  {
    path: 'pages',
    component: MenuPrincipal,
    loadChildren: () =>
      import('./pages/pages.routes').then((x) => x.pagesRoutes),
  },
];
