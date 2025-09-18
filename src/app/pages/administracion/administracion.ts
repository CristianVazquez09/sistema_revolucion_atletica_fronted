import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type AdminCard = {
  key: 'membresias' | 'corte' | 'socios' | 'estadisticas' | 'informes';
  titulo: string;
  descripcion: string;
  ruta: string | any[];
  iconBg: string; // tailwind bg-* para el círculo del ícono
};

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css' // opcional; puedes dejarlo vacío
})
export class Administracion {
  // Ajusta estas rutas a las reales de tu router
  cards: AdminCard[] = [
    { key: 'membresias',  titulo: 'Membresías',     descripcion: 'Inscribir · Reinscribir',      ruta: ['/pages/inscripcion'],  iconBg: 'bg-blue-100' },
    { key: 'corte',       titulo: 'Corte de caja',  descripcion: 'Abrir · Cerrar · Resumen',      ruta: ['/pages/corte-caja'],   iconBg: 'bg-emerald-100' },
    { key: 'socios',      titulo: 'Socios',         descripcion: 'Altas · Edición · Historial',   ruta: ['/pages/socio'],        iconBg: 'bg-indigo-100' },
    { key: 'estadisticas',titulo: 'Estadísticas',   descripcion: 'Indicadores y tendencias',      ruta: ['/pages/estadisticas'], iconBg: 'bg-amber-100' },
    { key: 'informes',    titulo: 'Informes',       descripcion: 'Reportes y exportaciones',      ruta: ['/pages/informes'],     iconBg: 'bg-rose-100' },
  ];
}
