import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, startWith } from 'rxjs/operators';

type AdminCard = {
  key: 'membresias' | 'corte' | 'cortes' | 'estadisticas' | 'informes';
  titulo: string;
  descripcion: string;
  ruta: string | any[];
  iconBg: string;
};

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet], // 👈 SIN FormsModule, SIN NgModel
  templateUrl: './administracion.html',
  styleUrl: './administracion.css'
})
export class Administracion {
  mostrarTarjetas = true;
  tituloHijo = '';

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      startWith(null)
    ).subscribe(() => {
      const url = this.router.url.replace(/\/+$/, '');
      // Mostrar tarjetas solo en /admin
      this.mostrarTarjetas = /\/admin$/.test(url);
      // Título del hijo (si hay)
      const child = this.route.firstChild;
      this.tituloHijo = child?.snapshot?.data?.['title'] ?? '';
    });
  }

  cards: AdminCard[] = [
    { key: 'membresias',  titulo: 'Membresías',     descripcion: 'Inscribir · Reinscribir',  ruta: ['membresias'],  iconBg: 'bg-blue-100' },
    { key: 'cortes',      titulo: 'Cortes de caja', descripcion: 'Movimientos y totales',    ruta: ['corte-caja'],  iconBg: 'bg-rose-100' },
    { key: 'corte',       titulo: 'Ventas',         descripcion: 'POS · Detalles',           ruta: ['ventas'],      iconBg: 'bg-emerald-100' },
  ];

  regresar(): void {
    if (this.router.url.startsWith('/pages/')) this.router.navigate(['/pages/admin']);
    else this.router.navigate(['/admin']);
  }
}
