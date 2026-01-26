import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, startWith } from 'rxjs/operators';

type AdminCard = {
  key:
    | 'membresias'
    | 'cortes'
    | 'ventas'
    | 'gimnasios'
    | 'estadisticas'
    | 'usuarios'
    | 'asesoriasNutri'
    | 'promociones'; // ✅ NUEVO
  titulo: string;
  descripcion: string;
  ruta: string | any[];
  iconBg: string;
};

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css'
})
export class Administracion {
  mostrarTarjetas = true;
  tituloHijo = '';
  sectionTitle = '';
  allowed: string[] = [];

  private allCards: AdminCard[] = [
    { key: 'membresias', titulo: 'Membresías', descripcion: 'Inscribir · Reinscribir', ruta: ['membresias'], iconBg: 'bg-blue-100' },
    { key: 'cortes', titulo: 'Cortes de caja', descripcion: 'Movimientos y totales', ruta: ['corte-caja'], iconBg: 'bg-rose-100' },
    { key: 'ventas', titulo: 'Ventas', descripcion: 'POS · Detalles', ruta: ['ventas'], iconBg: 'bg-emerald-100' },
    { key: 'gimnasios', titulo: 'Gimnasios', descripcion: 'Sedes y sucursales', ruta: ['gimnasios'], iconBg: 'bg-indigo-100' },
    { key: 'estadisticas', titulo: 'Estadísticas', descripcion: 'Indicadores y tendencias', ruta: ['estadisticas'], iconBg: 'bg-amber-100' },
    { key: 'usuarios', titulo: 'Usuarios', descripcion: 'Roles y permisos', ruta: ['usuarios'], iconBg: 'bg-slate-100' },

    // ✅ PROMOCIONES (ADMIN y GERENTE; controlado por "allowed" en routes)
    { key: 'promociones', titulo: 'Promociones', descripcion: 'Descuentos · Meses gratis · Vigencias', ruta: ['promociones'], iconBg: 'bg-fuchsia-100' },

    { key: 'asesoriasNutri', titulo: 'Asesorías nutricionales', descripcion: 'Asesorados de Roberto (vigencias)', ruta: ['asesorias-nutricionales'], iconBg: 'bg-lime-100' }
  ];

  get cards(): AdminCard[] {
    return this.allowed?.length ? this.allCards.filter((c) => this.allowed.includes(c.key)) : this.allCards;
  }

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), startWith(null))
      .subscribe(() => {
        const url = this.router.url.replace(/\/+$/, '');
        this.mostrarTarjetas = /(\/admin|\/gerencia)$/.test(url);

        this.sectionTitle = this.route.snapshot.data?.['sectionTitle'] ?? 'Administración';
        this.allowed = this.route.snapshot.data?.['allowed'] ?? [];
        this.tituloHijo = this.route.firstChild?.snapshot?.data?.['title'] ?? '';
      });
  }

  regresar(): void {
    const base = this.router.url.includes('/gerencia') ? '/pages/gerencia' : '/pages/admin';
    this.router.navigate([base]);
  }
}
