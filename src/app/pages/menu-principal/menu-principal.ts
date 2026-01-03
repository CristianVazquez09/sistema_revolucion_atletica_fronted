import { Component, HostListener, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

import { MenuService } from '../../services/menu-service';
import { MenuData } from '../../model/menu-data';
import { environment } from '../../../environments/environment';
import { CorteCajaService } from '../../services/corte-caja-service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-menu-principal',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass],
  templateUrl: './menu-principal.html',
  styleUrl: './menu-principal.css'
})
export class MenuPrincipal {
  menus: MenuData[] = [];
  username = '';
  cargando = false;
  errorMsg: string | null = null;

  /** Estado del drawer (menú desplegable) */
  menuAbierto = signal(false);
  
  

  constructor(
    private menuService: MenuService,
    private jwt: JwtHelperService,
    private router: Router,
    private corteState: CorteCajaService
  ) {
    this.menuAbierto = this.menuService.menuAbierto;
  }

  

  ngOnInit(): void {
    this.username = sessionStorage.getItem('username') ?? '';
    if (!this.username) {
      const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
      const decoded: any = token ? this.jwt.decodeToken(token) : null;
      this.username = decoded?.preferred_username ?? decoded?.sub ?? '';
    }

    if (this.username) {
      this.cargando = true;
      this.menuService.getMenusByUser(this.username).subscribe({
        next: (data) => {
          this.menus = data ?? [];
          this.menuService.setMenuChange(this.menus);
          this.cargando = false;
        },
        error: () => {
          this.cargando = false;
          this.errorMsg = 'No fue posible cargar los menús.';
        }
      });
    } else {
      this.menus = [];
      this.menuService.setMenuChange([]);
    }
  }

  toggleMenu(): void { this.menuService.toggleDrawer(); }
  closeMenu(): void { this.menuService.cerrarDrawer(); }

  /** Cerrar con tecla ESC */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'Escape' && this.menuAbierto()) this.closeMenu();
  }

  get fechaHoy(): string {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const s = new Date().toLocaleDateString('es-MX', opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  cerrarSesion(): void {
    try {
      sessionStorage.removeItem(environment.TOKEN_NAME);
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('authorities');
      this.menuService.setMenuChange([]);
      this.menus = [];
    } finally {
      this.router.navigate(['/login']);
    }
  }
}
