import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';

import { hoyISO } from '../../util/fechas-precios';
import { MenuService } from 'src/app/services/menu-service';

import { InventarioService } from '../../services/inventario-service';
import { GimnasioService } from '../../services/gimnasio-service';
import { GimnasioData } from '../../model/gimnasio-data';
import { InventarioDiarioProductoData, TurnoInventario } from '../../model/inventario-diario-data';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventario.html',
  styleUrl: './inventario.css',
})
export class Inventario implements OnInit {
  private invSrv = inject(InventarioService);
  private gymSrv = inject(GimnasioService);
  private jwt = inject(JwtHelperService);
  private menuSrv = inject(MenuService);

  menuAbierto = this.menuSrv.menuAbierto;

  isAdmin = false;

  // filtros
  fecha = signal<string>(hoyISO());
  turno = signal<TurnoInventario>('MANANA');
  termino = signal<string>('');
  gimnasioId = signal<number | null>(null);

  // data
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  filas = signal<InventarioDiarioProductoData[]>([]);

  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;

  turnosDisponibles = computed<TurnoInventario[]>(() => {
    return this.esFinDeSemana(this.fecha()) ? ['UNICO'] : ['MANANA', 'TARDE'];
  });

  filasFiltradas = computed(() => {
    const q = (this.termino() ?? '').trim().toLowerCase();
    const list = this.filas() ?? [];
    if (!q) return list;

    return list.filter((x) => {
      const n = String(x.nombre ?? '').toLowerCase();
      const c = String(x.codigo ?? '').toLowerCase();
      return n.includes(q) || c.includes(q) || String(x.idProducto).includes(q);
    });
  });

  ngOnInit(): void {
    this.isAdmin = this.esAdminDesdeToken();
    this.ajustarTurnoPorFecha();

    if (this.isAdmin) {
      this.cargarGimnasios(() => this.cargar());
    } else {
      this.cargar();
    }
  }

  private esAdminDesdeToken(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
        ...(Array.isArray(decoded?.realm_access?.roles)
          ? decoded.realm_access.roles
          : []),
      ]
        .concat([decoded?.role, decoded?.rol, decoded?.perfil].filter(Boolean) as string[])
        .map((r) => String(r).toUpperCase());

      return decoded?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch {
      return false;
    }
  }

  private esFinDeSemana(iso: string): boolean {
    const d = new Date(`${iso}T00:00:00`);
    const day = d.getDay(); // 0 dom, 6 sab
    return day === 0 || day === 6;
  }

  private ajustarTurnoPorFecha(): void {
    const weekend = this.esFinDeSemana(this.fecha());
    const actual = this.turno();
    if (weekend) {
      if (actual !== 'UNICO') this.turno.set('UNICO');
    } else {
      if (actual === 'UNICO') this.turno.set('MANANA');
    }
  }

  onFechaChange(v: string) {
    this.fecha.set(v);
    this.ajustarTurnoPorFecha();
    this.cargar();
  }

  onTurnoChange(v: TurnoInventario) {
    this.turno.set(v);
    this.cargar();
  }

  onGymChange(v: any) {
    const n = v != null ? Number(v) : null;
    this.gimnasioId.set(Number.isFinite(n as any) ? n : null);
    this.cargar();
  }

  refrescar() {
    this.cargar();
  }

  private cargarGimnasios(done?: () => void) {
    this.cargandoGimnasios = true;
    this.gymSrv.buscarTodos().subscribe({
      next: (lista) => {
        // solo activos (si no existe activo, se asume activo)
        const soloActivos = (lista ?? []).filter((g: any) => g?.activo !== false);

        // normaliza idGimnasio (por si llega id)
        this.gimnasios = soloActivos.map((g: any) => ({
          idGimnasio: typeof g.idGimnasio === 'number' ? g.idGimnasio : Number(g.id),
          nombre: g.nombre,
          direccion: g.direccion,
          telefono: g.telefono
        }));

        // default: primer gimnasio
        if (this.gimnasios.length && this.gimnasioId() == null) {
          this.gimnasioId.set(this.gimnasios[0].idGimnasio ?? null);
        }

        this.cargandoGimnasios = false;
        done?.();
      },
      error: () => {
        this.cargandoGimnasios = false;
        done?.();
      }
    });
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    const fecha = this.fecha();
    const turno = this.turno();
    const gimnasioId = this.isAdmin ? this.gimnasioId() : null;

    this.invSrv.diario({ fecha, turno, gimnasioId }).subscribe({
      next: (data) => {
        this.filas.set(data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('No se pudo cargar el inventario.');
        this.loading.set(false);
      },
    });
  }

  turnoLabel(t: TurnoInventario): string {
    if (t === 'MANANA') return 'Mañana';
    if (t === 'TARDE') return 'Tarde';
    return 'Único';
  }
}
