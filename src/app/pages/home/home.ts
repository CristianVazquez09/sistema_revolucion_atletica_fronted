// src/app/pages/home/home.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';

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
export class Home implements OnInit {
  private jwt = inject(JwtHelperService);

  username = '';
  rol: Rol = 'recepcionista';
  version = 'v0.1.5';

  readonly novedades: Novedad[] = [
    {
      titulo: 'Paquete RA — nuevo atributo',
      descripcion: 'Los paquetes ahora tienen un campo "Paquete RA". Al activarlo, en inscripción y reinscripción aparece un selector para asignar el entrenador RA correspondiente, y su nombre queda registrado en el ticket.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'amber',
      iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
    {
      titulo: 'Tickets rediseñados',
      descripcion: 'Nuevo diseño más limpio y profesional: folio grande destacado, texto compacto, secciones bien definidas y sin prefijos innecesarios en métodos de pago.',
      roles: ['admin', 'gerente', 'recepcionista'],
      color: 'blue',
      iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      titulo: 'Promociones',
      descripcion: 'Crea y gestiona descuentos, meses gratis y vigencias especiales que se aplican al momento de inscribir o reinscribir a un socio.',
      roles: ['admin', 'gerente'],
      color: 'fuchsia',
      iconPath: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    },
    {
      titulo: 'Dashboard de Estadísticas',
      descripcion: 'Gráficas interactivas con ingresos por día (membresías, ventas y asesorías), asistencias, género, edad, membresías por tipo y alertas de vencimientos.',
      roles: ['admin'],
      color: 'violet',
      iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      titulo: 'Reportes exportables',
      descripcion: 'Exporta en Excel los reportes de movimientos, membresías, cortes de caja y más desde la sección Reportes del panel de administración.',
      roles: ['admin'],
      color: 'teal',
      iconPath: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
    },
    {
      titulo: 'Asesorías Nutricionales',
      descripcion: 'Módulo para registrar y consultar las asesorías nutricionales, con control de vigencias y listado de socios asesorados.',
      roles: ['admin'],
      color: 'lime',
      iconPath: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    },
    {
      titulo: 'Gestión de Usuarios',
      descripcion: 'Crea usuarios, asigna roles (Admin, Gerente, Recepcionista) y controla accesos por sucursal desde el panel de administración.',
      roles: ['admin'],
      color: 'slate',
      iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
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

  ngOnInit(): void {
    this.username = sessionStorage.getItem('username') ?? '';
    this.rol = this.detectarRol();
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
}
