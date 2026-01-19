// src/app/pages/inventario/inventario.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import { hoyISO } from '../../util/fechas-precios';

import { MenuService } from 'src/app/services/menu-service';
import { InventarioService } from '../../services/inventario-service';
import { GimnasioService } from '../../services/gimnasio-service';
import { NotificacionService } from '../../services/notificacion-service';

import { GimnasioData } from '../../model/gimnasio-data';
import {
  InventarioDiarioProductoData,
  InventarioTurnoResponseData,
  TurnoInventario,
} from '../../model/inventario-diario-data';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.html',
  styleUrl: './inventario.css',
})
export class Inventario implements OnInit {
  private invSrv = inject(InventarioService);
  private gymSrv = inject(GimnasioService);
  private jwt = inject(JwtHelperService);
  private menuSrv = inject(MenuService);
  private notificacion = inject(NotificacionService);
  private destroyRef = inject(DestroyRef);

  menuAbierto = this.menuSrv.menuAbierto;

  // roles
  isAdmin = false;
  isGerente = false;
  puedeCerrar = false;

  // hoy (para max del datepicker)
  hoyMax = hoyISO();

  // ✅ desde cuándo aplican reglas estrictas (para no romper históricos)
  reglasDesde: string = (environment as any)?.INVENTARIO_REGLAS_DESDE || this.hoyMax;

  // filtros
  fecha = signal<string>(this.hoyMax);
  turno = signal<TurnoInventario>('MANANA');
  termino = signal<string>('');
  gimnasioId = signal<number | null>(null);

  // estado del turno actual
  cerrado = signal<boolean>(false);
  fechaCierre = signal<string | null>(null);
  cerradoPor = signal<string | null>(null);

  // 🔒 para habilitar TARDE (solo entre semana y solo si reglas aplican)
  mananaCerrado = signal<boolean>(false);

  // data
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  filas = signal<InventarioDiarioProductoData[]>([]);

  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;

  finDeSemana = computed(() => this.esFinDeSemana(this.fecha()));

  // ✅ si fecha < reglasDesde -> NO aplicar bloqueo por cierres (para históricos)
  aplicanReglas = computed(() => {
    const f = this.fecha();
    return !!f && f >= this.reglasDesde; // ISO YYYY-MM-DD compara bien por string
  });

  // ✅ turnos disponibles:
  // - fin de semana -> UNICO (sin validaciones de mañana/tarde)
  // - entre semana:
  //   - si NO aplican reglas -> MANANA y TARDE (sin bloquear)
  //   - si aplican reglas -> TARDE solo si MAÑANA cerrado
  turnosDisponibles = computed<TurnoInventario[]>(() => {
    if (this.finDeSemana()) return ['UNICO'];
    if (!this.aplicanReglas()) return ['MANANA', 'TARDE'];
    return this.mananaCerrado() ? ['MANANA', 'TARDE'] : ['MANANA'];
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
    const roles = this.rolesDesdeToken();
    this.isAdmin = roles.has('ADMIN') || roles.has('ROLE_ADMIN');
    this.isGerente = roles.has('GERENTE') || roles.has('ROLE_GERENTE');
    this.puedeCerrar = this.isAdmin || this.isGerente;

    this.ajustarTurnoPorFecha();

    if (this.isAdmin) {
      this.cargarGimnasios(() => this.syncEstadoManana(() => this.cargar()));
    } else {
      this.syncEstadoManana(() => this.cargar());
    }
  }

  // =========================
  // Helpers
  // =========================
  private rolesDesdeToken(): Set<string> {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    const out = new Set<string>();
    if (!raw) return out;

    try {
      const decoded: any = this.jwt.decodeToken(raw);

      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
        ...(Array.isArray(decoded?.realm_access?.roles) ? decoded.realm_access.roles : []),
      ]
        .concat([decoded?.role, decoded?.rol, decoded?.perfil].filter(Boolean) as string[])
        .map((r) => String(r).toUpperCase());

      for (const r of roles) out.add(r);
      if (decoded?.is_admin === true) out.add('ADMIN');

      return out;
    } catch {
      return out;
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

  private extraerMensajeError(err: any): string {
    const e: any = err?.error;

    if (e?.detail) return String(e.detail);
    if (e?.title) return String(e.title);
    if (e?.message) return String(e.message);
    if (e?.mensaje) return String(e.mensaje);
    if (typeof e === 'string') return e;

    return err?.message || 'Ocurrió un error.';
  }

  private normalizarFechaNoFutura(v: string): string {
    if (!v) return this.hoyMax;
    if (v > this.hoyMax) {
      const msg = 'No puedes seleccionar una fecha futura.';
      this.notificacion.aviso(msg);
      return this.hoyMax;
    }
    return v;
  }

  // ✅ Formato UI: "YYYY-MM-DD HH:mm" (sin segundos)
  fechaHoraMin(isoOrDate: string | null): string | null {
    if (!isoOrDate) return null;

    const s = String(isoOrDate);

    // Caso típico: "2026-01-19T14:03:22.123" o "2026-01-19T14:03:22"
    const tPos = s.indexOf('T');
    if (tPos > 0) {
      const yyyyMMdd = s.slice(0, tPos);
      const hhmm = s.slice(tPos + 1, tPos + 6); // HH:mm
      if (yyyyMMdd.length === 10 && hhmm.length === 5) return `${yyyyMMdd} ${hhmm}`;
    }

    // Fallback
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return s;

    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  // =========================
  // 🔒 Validación TARDE: checar MAÑANA cerrado
  // - NO se hace en fin de semana (UNICO)
  // - NO se hace antes de reglasDesde (histórico)
  // =========================
  private syncEstadoManana(done?: () => void) {
    const fecha = this.fecha();

    // fin de semana: no aplica
    if (this.esFinDeSemana(fecha)) {
      this.mananaCerrado.set(false);
      done?.();
      return;
    }

    // antes de reglasDesde: no bloquear TARDE
    if (!this.aplicanReglas()) {
      this.mananaCerrado.set(true);
      done?.();
      return;
    }

    const gimnasioId = this.isAdmin ? this.gimnasioId() : null;

    this.invSrv
      .turno({ fecha, turno: 'MANANA', gimnasioId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const ok = !!res?.cerrado;
          this.mananaCerrado.set(ok);

          if (this.turno() === 'TARDE' && !ok) {
            this.turno.set('MANANA');
            const msg = 'Para habilitar el turno TARDE, primero debes cerrar el inventario de MAÑANA.';
            this.error.set(msg);
            this.notificacion.aviso(msg);
          }

          done?.();
        },
        error: (err: HttpErrorResponse) => {
          const msg = this.extraerMensajeError(err) || 'No se pudo validar el estado de MAÑANA.';
          this.mananaCerrado.set(false);
          this.error.set(msg);

          if (this.turno() === 'TARDE') this.turno.set('MANANA');

          this.notificacion.error(msg);
          done?.();
        },
      });
  }

  // =========================
  // Eventos UI
  // =========================
  onFechaChange(v: string) {
    const f = this.normalizarFechaNoFutura(v);
    this.fecha.set(f);

    this.ajustarTurnoPorFecha();

    this.syncEstadoManana(() => this.cargar());
  }

  onGymChange(v: any) {
    const n = v != null ? Number(v) : null;
    this.gimnasioId.set(Number.isFinite(n as any) ? n : null);

    this.syncEstadoManana(() => this.cargar());
  }

  onTurnoChange(v: TurnoInventario) {
    // fin de semana: solo UNICO
    if (this.finDeSemana()) {
      this.turno.set('UNICO');
      this.cargar();
      return;
    }

    // si no aplican reglas (histórico), no bloquear TARDE
    if (!this.aplicanReglas()) {
      this.turno.set(v);
      this.cargar();
      return;
    }

    // reglas activas
    if (v === 'TARDE' && !this.mananaCerrado()) {
      const msg = 'Para habilitar el turno TARDE, primero debes cerrar el inventario de MAÑANA.';
      this.error.set(msg);
      this.notificacion.aviso(msg);
      this.turno.set('MANANA');
      return;
    }

    this.turno.set(v);
    this.cargar();
  }

  refrescar() {
    this.syncEstadoManana(() => this.cargar());
  }

  cerrarTurno() {
    if (!this.puedeCerrar) return;
    if (this.cerrado()) return;

    const fecha = this.fecha();
    const turno = this.turno();

    const ok = confirm(`¿Cerrar inventario del ${fecha} (${this.turnoLabel(turno)})?`);
    if (!ok) return;

    this.loading.set(true);
    this.error.set(null);

    this.invSrv
      .cerrar({ fecha, turno })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notificacion.exito('Turno cerrado con éxito.');
          this.syncEstadoManana(() => this.cargar());
        },
        error: (err: HttpErrorResponse) => {
          const msg = this.extraerMensajeError(err) || 'No se pudo cerrar el turno.';
          this.error.set(msg);
          this.notificacion.error(msg);
          this.loading.set(false);
        },
      });
  }

  private cargarGimnasios(done?: () => void) {
    this.cargandoGimnasios = true;

    this.gymSrv
      .buscarTodos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lista) => {
          const soloActivos = (lista ?? []).filter((g: any) => g?.activo !== false);

          this.gimnasios = soloActivos.map((g: any) => ({
            idGimnasio: typeof g.idGimnasio === 'number' ? g.idGimnasio : Number(g.id),
            nombre: g.nombre,
            direccion: g.direccion,
            telefono: g.telefono,
          }));

          if (this.gimnasios.length && this.gimnasioId() == null) {
            this.gimnasioId.set(this.gimnasios[0].idGimnasio ?? null);
          }

          this.cargandoGimnasios = false;
          done?.();
        },
        error: () => {
          this.cargandoGimnasios = false;
          done?.();
        },
      });
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    const fecha = this.fecha();
    const turno = this.turno();
    const gimnasioId = this.isAdmin ? this.gimnasioId() : null;

    this.invSrv
      .turno({ fecha, turno, gimnasioId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: InventarioTurnoResponseData) => {
          this.cerrado.set(!!res?.cerrado);
          this.fechaCierre.set(res?.fechaCierre ?? null);
          this.cerradoPor.set(res?.cerradoPor ?? null);

          // si es entre semana y en MAÑANA, refrescamos flag de bloqueo
          if (!this.finDeSemana() && turno === 'MANANA' && this.aplicanReglas()) {
            this.mananaCerrado.set(!!res?.cerrado);
          }

          this.filas.set(res?.items ?? []);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          const msg = this.extraerMensajeError(err) || 'No se pudo cargar el inventario.';
          this.error.set(msg);
          this.loading.set(false);

          // si backend bloqueó TARDE, regresamos a MANANA
          if (this.turno() === 'TARDE') {
            this.turno.set('MANANA');
            this.syncEstadoManana();
          }

          this.notificacion.error(msg);
        },
      });
  }

  // =========================
  // UI helpers
  // =========================
  turnoLabel(t: TurnoInventario): string {
    if (t === 'MANANA') return 'Mañana';
    if (t === 'TARDE') return 'Tarde';
    return 'Único';
  }

  estadoLabel(): string {
    return this.cerrado() ? 'Cerrado' : 'Abierto';
  }

  estadoClase(): string {
    return this.cerrado()
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : 'bg-amber-50 text-amber-700 ring-amber-200';
  }

  bloqueoTardeMsg(): string | null {
    if (this.finDeSemana()) return null;
    if (!this.aplicanReglas()) return null;
    return this.mananaCerrado() ? null : 'TARDE se habilita cuando MAÑANA está cerrado.';
  }
}
