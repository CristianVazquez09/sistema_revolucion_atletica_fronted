import { Component, HostListener, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

import { MenuService } from '../../services/menu-service';
import { MenuData } from '../../model/menu-data';
import { environment } from '../../../environments/environment';
import { CorteCajaService } from '../../services/corte-caja-service';
import { NgClass } from '@angular/common';
import {
  avatarColorByStyle,
  avatarImageByStyle,
  loadPreferenciasUsuario,
} from '../../util/preferencias-usuario';

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
  avatarColor = '#0B2C4A';
  avatarImage: string | null = null;

  menuAbierto = signal(false);
  perfilAbierto = signal(false);

  constructor(
    private menuService: MenuService,
    private jwt: JwtHelperService,
    private router: Router,
    private corteState: CorteCajaService
  ) {
    this.menuAbierto = this.menuService.menuAbierto;
  }

  ngOnInit(): void {
    this.sincronizarPreferencias();
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
  togglePerfil(): void { this.perfilAbierto.update(v => !v); }
  cerrarPerfil(): void { this.perfilAbierto.set(false); }

  irAPerfil(): void {
    this.cerrarPerfil();
    this.router.navigate(['/pages/mi-perfil']);
  }

  /** Nombre completo o username si no hay nombre/apellido */
  get nombreDisplay(): string {
    const n = (sessionStorage.getItem('nombre')   ?? '').trim();
    const a = (sessionStorage.getItem('apellido') ?? '').trim();
    return [n, a].filter(Boolean).join(' ') || this.username || 'Usuario';
  }

  /** Iniciales para el avatar */
  get initiales(): string {
    const n = (sessionStorage.getItem('nombre')   ?? '').trim();
    const a = (sessionStorage.getItem('apellido') ?? '').trim();
    if (n && a) return (n[0] + a[0]).toUpperCase();
    if (n)      return n.substring(0, 2).toUpperCase();
    return (this.username || 'U').substring(0, 2).toUpperCase();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      if (this.perfilAbierto()) this.cerrarPerfil();
      else if (this.menuAbierto()) this.closeMenu();
    }
  }

  /** Cerrar perfil al hacer click fuera */
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (!target.closest('#perfil-menu-wrapper')) {
      this.cerrarPerfil();
    }
  }

  @HostListener('window:ra-preferencias-updated')
  onPreferenciasUpdated() {
    this.sincronizarPreferencias();
  }

  get fechaHoy(): string {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const s = new Date().toLocaleDateString('es-MX', opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  cerrarSesion(): void {
    this.cerrarPerfil();
    try {
      sessionStorage.removeItem(environment.TOKEN_NAME);
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('authorities');
      sessionStorage.removeItem('nombre');
      sessionStorage.removeItem('apellido');
      this.menuService.setMenuChange([]);
      this.menus = [];
    } finally {
      this.router.navigate(['/login']);
    }
  }

  private sincronizarPreferencias(): void {
    const prefs = loadPreferenciasUsuario();
    this.avatarColor = avatarColorByStyle(prefs.avatarStyle);
    this.avatarImage = avatarImageByStyle(prefs.avatarStyle);
    document.body.style.cursor = '';
  }
}
