import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

import { MenuService } from '../../services/menu-service';
import { MenuData } from '../..//model/menu-data';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-menu-principal',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './menu-principal.html',
  styleUrl: './menu-principal.css'
})
export class MenuPrincipal {
  menus: MenuData[] = [];
  username = '';
  cargando = false;
  errorMsg: string | null = null;

  constructor(
    private menuService: MenuService,
    private jwt: JwtHelperService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // 1) Obtener el nombre (primero lo guardado; si no, del token -> sub)
    this.username = sessionStorage.getItem('username') ?? '';
    if (!this.username) {
      const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
      const decoded: any = token ? this.jwt.decodeToken(token) : null;
      this.username = decoded?.preferred_username ?? decoded?.sub ?? '';
    }

    // 2) Si tenemos nombre, pedir menús (usando tu MenuService tal cual)
    if (this.username) {
      this.cargando = true;
      this.errorMsg = null;
      this.menuService.getMenusByUser(this.username).subscribe({
        next: (data) => {
          this.menus = data ?? [];
          this.menuService.setMenuChange(this.menus); // si otros componentes escuchan
          this.cargando = false;
          // Debug útil:
          // console.debug('Menús cargados para', this.username, this.menus);
        },
        error: (e) => {
          this.cargando = false;
          this.errorMsg = 'No fue posible cargar los menús.';
          // console.error(e);
        }
      });
    } else {
      // No hay nombre disponible; evita llamadas vacías
      this.menus = [];
      this.menuService.setMenuChange([]);
    }
  }


  get fechaHoy(): string {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const s = new Date().toLocaleDateString('es-MX', opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

   cerrarSesion(): void {
    try {
      // Limpia credenciales y cualquier resto de sesión
      sessionStorage.removeItem(environment.TOKEN_NAME);
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('authorities');

      // Limpia el estado de menús en memoria
      this.menuService.setMenuChange([]);
      this.menus = [];
    } finally {
      // Redirige al login
      this.router.navigate(['/login']);
    }
  }
}
