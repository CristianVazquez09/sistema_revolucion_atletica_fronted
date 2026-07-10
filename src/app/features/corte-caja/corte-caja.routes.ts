import { Routes } from '@angular/router';

export const CORTE_CAJA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/corte-caja/corte-caja').then((m) => m.CorteCaja),
  },
];
