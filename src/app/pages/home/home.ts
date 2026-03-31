// src/app/pages/home/home.ts
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import { fraseHomeByMode, loadPreferenciasUsuario } from '../../util/preferencias-usuario';

type Rol = 'admin' | 'gerente' | 'recepcionista';

export interface Novedad {
  titulo: string;
  descripcion: string;
  roles: Rol[];
  color: string;
  // path del SVG icon (viewBox 0 0 24 24)
  iconPath: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
})
export class Home implements OnInit, OnDestroy {
  private jwt = inject(JwtHelperService);
  private readonly onPrefsUpdated = () => this.actualizarFrase();

  username = '';
  rol: Rol = 'recepcionista';
  version = 'v0.1.7';
  fraseHome = 'Esfuerzate y se valiente';

  readonly novedades: Novedad[] = [
    {
      titulo: 'Alertas de cierre de inventario',
      descripcion: 'El sistema ahora avisa automáticamente a los 20, 10 y 5 minutos antes — y a la hora exacta — de que el turno de inventario debe cerrarse, con sonido incluido.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'amber',
      iconPath: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    },
    {
      titulo: 'Tipo de asesoría visible (Admin)',
      descripcion: 'En la vista de entrenadores y en el Excel exportado, ahora se distingue si la asesoría es Individual o Paquete RA.',
      roles: ['admin'],
      color: 'violet',
      iconPath: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    },
    {
      titulo: 'Droplets en entrenadores corregidos',
      descripcion: 'Se corrigió el menú de acciones (tres puntos) en la tabla de entrenadores que quedaba oculto al estar dentro de un contenedor. Ahora se muestra correctamente sobre todo el contenido.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'teal',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      titulo: 'Mi Perfil de Usuario',
      descripcion: 'Se agrega la vista Mi perfil desde el menú principal para consultar datos de cuenta y actualizar nombre/apellido de forma directa.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'blue',
      iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      titulo: 'Droplets en tablas',
      descripcion: 'Se estandariza el menú de acciones con tres puntos en las tablas del sistema. El panel ahora es más compacto y se muestra en sobreposición para mejorar la visibilidad.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'slate',
      iconPath: 'M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5z',
    },
    {
      titulo: 'Estadísticas Admin ampliadas',
      descripcion: 'Se incorporan nuevas métricas: ranking de entrenadores, productos más/menos vendidos, paquetes más/menos vendidos en periodo y distribución de edades.',
      roles: ['admin'],
      color: 'violet',
      iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      titulo: 'Descuentos en membresías y ventas',
      descripcion: 'Recepción y gerencia ya pueden aplicar descuentos al registrar membresías y también durante ventas en punto de venta.',
      roles: ['gerente', 'recepcionista'],
      color: 'amber',
      iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-10v12m9-6a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      titulo: 'Corrección en inscripciones',
      descripcion: 'Se corrigió el formulario para que los datos queden guardados correctamente apesar de cambiar de menú.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'fuchsia',
      iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      titulo: 'Tickets en retiros de efectivo',
      descripcion: 'Los retiros de efectivo ahora también imprimen ticket para todos los roles.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'teal',
      iconPath: 'M4 7h16M7 3h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z',
    },
  ];

  get novedadesFiltradas(): Novedad[] {
    return this.novedades.filter(n => n.roles.includes(this.rol));
  }

  get rolLabel(): string {
    const labels: Record<Rol, string> = {
      admin: 'Administrador',
      gerente: 'Gerente',
      recepcionista: 'Recepcionista',
    };
    return labels[this.rol];
  }

  get rolBadge(): string {
    const colors: Record<Rol, string> = {
      admin: 'bg-red-100 text-red-700',
      gerente: 'bg-amber-100 text-amber-700',
      recepcionista: 'bg-blue-100 text-blue-700',
    };
    return colors[this.rol];
  }

  get nombreDisplay(): string {
    const n = (sessionStorage.getItem('nombre')   ?? '').trim();
    const a = (sessionStorage.getItem('apellido') ?? '').trim();
    return [n, a].filter(Boolean).join(' ') || this.username || 'Usuario';
  }

  ngOnInit(): void {
    this.username = sessionStorage.getItem('username') ?? '';
    this.rol = this.detectarRol();
    this.actualizarFrase();
    window.addEventListener('ra-preferencias-updated', this.onPrefsUpdated as EventListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('ra-preferencias-updated', this.onPrefsUpdated as EventListener);
  }

  private detectarRol(): Rol {
    try {
      const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
      if (!token) return 'recepcionista';
      const d: any = this.jwt.decodeToken(token);
      const roles: string[] = [
        ...(Array.isArray(d?.roles) ? d.roles : []),
        ...(Array.isArray(d?.authorities) ? d.authorities : []),
        ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
        ...[d?.role, d?.rol, d?.perfil].filter(Boolean),
      ].map(r => String(r).toUpperCase());

      if (d?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN')) return 'admin';
      if (roles.includes('GERENTE') || roles.includes('ROLE_GERENTE')) return 'gerente';
      return 'recepcionista';
    } catch {
      return 'recepcionista';
    }
  }

  iconBg(color: string): string {
    const map: Record<string, string> = {
      amber:   'bg-amber-100 text-amber-600',
      blue:    'bg-blue-100 text-blue-600',
      violet:  'bg-violet-100 text-violet-600',
      teal:    'bg-teal-100 text-teal-600',
      fuchsia: 'bg-fuchsia-100 text-fuchsia-600',
      lime:    'bg-lime-100 text-lime-600',
      slate:   'bg-slate-100 text-slate-600',
    };
    return map[color] ?? map['slate'];
  }

  private actualizarFrase(): void {
    const prefs = loadPreferenciasUsuario();
    this.fraseHome = fraseHomeByMode(prefs.fraseHome, this.username);
  }
}
