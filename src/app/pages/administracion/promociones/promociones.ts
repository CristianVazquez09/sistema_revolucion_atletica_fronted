import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { JwtHelperService } from '@auth0/angular-jwt';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PromocionModal } from './promocion-modal/promocion-modal';

import { PromocionService } from 'src/app/services/promocion-service';
import { PaqueteService } from 'src/app/services/paquete-service';
import { GimnasioService } from 'src/app/services/gimnasio-service';
import { NotificacionService } from 'src/app/services/notificacion-service';
import { MenuService } from 'src/app/services/menu-service';

import { labelTipoPromocion, TipoPromocion } from 'src/app/util/enums/tipo-promocion';
import { PromocionData } from 'src/app/model/promocion-data';
import { PaqueteData } from 'src/app/model/paquete-data';
import { GimnasioData } from 'src/app/model/gimnasio-data';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-promociones',
  standalone: true,
  imports: [CommonModule, FormsModule, PromocionModal],
  templateUrl: './promociones.html',
  styleUrl: './promociones.css',
})
export class Promociones {
  private destroyRef = inject(DestroyRef);

  private promoSrv = inject(PromocionService);
  private paqueteSrv = inject(PaqueteService);
  private gymSrv = inject(GimnasioService);

  private noti = inject(NotificacionService);
  private jwt = inject(JwtHelperService);
  private menuSrv = inject(MenuService);
  private cdr = inject(ChangeDetectorRef);

  menuAbierto = this.menuSrv.menuAbierto;
  TipoPromocion = TipoPromocion;

  // =========================
  // Zoom / Layout
  // =========================
  @ViewChild('zoomOuter', { static: true }) zoomOuter!: ElementRef<HTMLElement>;
  uiZoom = 1;
  promosMaxH = 650;

  private ro?: ResizeObserver;

  private readonly MIN_ZOOM = 0.78;
  private readonly MAX_ZOOM = 1.0;

  esXlUp = signal(typeof window !== 'undefined' ? window.matchMedia('(min-width: 1280px)').matches : false);
  es2xlUp = signal(typeof window !== 'undefined' ? window.matchMedia('(min-width: 1536px)').matches : false);

  mostrarGimnasioCol = computed(() => {
    if (!this.esAdmin()) return false;
    return this.es2xlUp() || !this.menuAbierto();
  });

  // =========================
  // Estado
  // =========================
  cargando = signal(false);
  promociones = signal<PromocionData[]>([]);
  paquetes = signal<PaqueteData[]>([]);
  gimnasios = signal<GimnasioData[]>([]);
  cargandoGimnasios = signal(false);

  termino = signal('');
  soloVigentes = signal(true);
  soloActivas = signal(true);

  /**
   * ✅ IMPORTANTE:
   * Este selector es SOLO PARA LA TABLA.
   * NO se pasa al modal, NO afecta el modal.
   */
  gimnasioTablaId = signal<number | null>(null);

  modalAbierto = signal(false);
  editando = signal<PromocionData | null>(null);

  busyDesactivarId = signal<number | null>(null);
  busyEliminarId = signal<number | null>(null);

  roles = computed(() => this.rolesDesdeToken());
  esAdmin = computed(() => this.roles().includes('ADMIN') || this.roles().includes('ROLE_ADMIN'));
  esGerente = computed(() => this.roles().includes('GERENTE') || this.roles().includes('ROLE_GERENTE'));
  puedeGestionar = computed(() => this.esAdmin() || this.esGerente());

  filas = computed(() => {
    const term = (this.termino() ?? '').trim().toLowerCase();
    const soloVig = this.soloVigentes();
    const soloAct = this.soloActivas();
    const gymTabla = this.gimnasioTablaId();

    return (this.promociones() ?? [])
      .filter((p) => {
        if (soloAct && p.activo === false) return false;
        if (soloVig && !this.esVigente(p)) return false;

        // ✅ FILTRO DE GIMNASIO SOLO PARA TABLA
        if (this.esAdmin() && gymTabla != null) {
          const gId = this.getGymIdFromPromocion(p);
          if (gId == null || gId !== gymTabla) return false;
        }

        if (!term) return true;

        const nombre = String(p.nombre ?? '').toLowerCase();
        const desc = String(p.descripcion ?? '').toLowerCase();
        const tipo = String(p.tipo ?? '').toLowerCase();
        const paquete = this.paqueteLabel(p).toLowerCase();
        const restr = this.restriccionesTexto(p).toLowerCase();
        const gym = this.promoGymNombre(p).toLowerCase();

        return (
          nombre.includes(term) ||
          desc.includes(term) ||
          tipo.includes(term) ||
          paquete.includes(term) ||
          restr.includes(term) ||
          gym.includes(term)
        );
      })
      .sort((a, b) => {
        const ea = this.estadoLabel(a).texto;
        const eb = this.estadoLabel(b).texto;
        const order = (x: string) => (x === 'Vigente' ? 0 : x === 'Programada' ? 1 : x === 'Vencida' ? 2 : 3);
        return order(ea) - order(eb);
      });
  });

  ngOnInit(): void {
    if (this.esAdmin()) {
      this.cargarGimnasios(() => {
        this.cargarPaquetes();     // ✅ cargar TODOS
        this.cargarPromociones();  // ✅ cargar TODAS
      });
    } else {
      this.cargarPaquetes();
      this.cargarPromociones();
    }
  }

  ngAfterViewInit(): void {
    this.requestLayout();

    this.ro = new ResizeObserver(() => this.requestLayout());
    this.ro.observe(this.zoomOuter.nativeElement);

    window.addEventListener('resize', this.onWindowResize);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = (): void => {
    this.requestLayout();
  };

  // =========================
  // ADMIN: gimnasios (para TABLA)
  // =========================
  private cargarGimnasios(done?: () => void): void {
    this.cargandoGimnasios.set(true);

    this.gymSrv
      .buscarTodos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (gs) => {
          const vistos = new Set<number>();

          const norm = (gs ?? [])
            .map((g: any) => ({
              idGimnasio: typeof g.idGimnasio === 'number' ? g.idGimnasio : Number(g.id),
              nombre: g.nombre,
              direccion: g.direccion,
              telefono: g.telefono,
            } as GimnasioData))
            .filter((g) => {
              if (!g.idGimnasio) return false;
              if (vistos.has(g.idGimnasio)) return false;
              vistos.add(g.idGimnasio);
              return true;
            });

          this.gimnasios.set(norm);

          // default: el primero, SOLO para tabla
          if (this.gimnasioTablaId() == null && norm.length) {
            this.gimnasioTablaId.set(norm[0].idGimnasio);
          }

          this.cargandoGimnasios.set(false);
          this.requestLayout();
          done?.();
        },
        error: (err) => {
          console.error(err);
          this.gimnasios.set([]);
          this.cargandoGimnasios.set(false);
          this.requestLayout();
          done?.();
        },
      });
  }

  onCambiarGimnasioTabla(value: any): void {
    const id = value == null || value === '' ? null : Number(value);
    this.gimnasioTablaId.set(Number.isFinite(id as number) ? (id as number) : null);
    this.requestLayout();
  }

  // =========================
  // Carga
  // =========================
  recargar(): void {
    this.cargarPromociones();
  }

  private cargarPaquetes(): void {
    this.paqueteSrv
      .buscarTodos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ps) => this.paquetes.set(ps ?? []),
        error: (err) => {
          console.error(err);
          this.paquetes.set([]);
        },
      });
  }

  private cargarPromociones(): void {
    this.cargando.set(true);

    this.promoSrv
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lst) => {
          this.promociones.set(lst ?? []);
          this.cargando.set(false);
          this.requestLayout();
        },
        error: (err) => {
          console.error(err);
          this.cargando.set(false);
          this.noti.error('No se pudieron cargar las promociones.');
          this.requestLayout();
        },
      });
  }

  // =========================
  // Modal principal
  // =========================
  nuevo(): void {
    if (!this.puedeGestionar()) {
      this.noti.error('No autorizado.');
      return;
    }

    // ✅ Ya NO depende del selector de tabla
    this.editando.set(null);
    this.modalAbierto.set(true);
  }

  editar(row: PromocionData): void {
    if (!this.puedeGestionar()) {
      this.noti.error('No autorizado.');
      return;
    }

    this.editando.set(row);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.editando.set(null);
  }

  onGuardado(): void {
    this.cerrarModal();
    this.cargarPromociones();
  }

  // =========================
  // Acciones activar/desactivar/eliminar (tabla)
  // =========================
  desactivar(row: PromocionData): void {
    if (!this.puedeGestionar()) return;

    const id = this.idRow(row);
    if (!id) return;

    if (!confirm(`¿Desactivar la promoción "${row.nombre}"?`)) return;

    this.busyDesactivarId.set(id);

    this.promoSrv
      .desactivar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.noti.exito('Promoción desactivada.');
          this.busyDesactivarId.set(null);
          this.promociones.update((lst) => (lst ?? []).map((x) => (this.idRow(x) === id ? (updated ?? x) : x)));
        },
        error: (err) => {
          console.error(err);
          this.busyDesactivarId.set(null);
          this.noti.error('No se pudo desactivar la promoción.');
        },
      });
  }

  activar(row: PromocionData): void {
    if (!this.puedeGestionar()) return;

    const id = this.idRow(row);
    if (!id) return;

    this.busyDesactivarId.set(id);

    this.promoSrv
      .activar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.noti.exito('Promoción activada.');
          this.busyDesactivarId.set(null);
          this.promociones.update((lst) => (lst ?? []).map((x) => (this.idRow(x) === id ? (updated ?? x) : x)));
        },
        error: (err) => {
          console.error(err);
          this.busyDesactivarId.set(null);
          this.noti.error('No se pudo activar la promoción.');
        },
      });
  }

  eliminar(row: PromocionData): void {
    if (!this.puedeGestionar()) return;

    const id = this.idRow(row);
    if (!id) return;

    if (!confirm(`¿Eliminar la promoción "${row.nombre}"? Esta acción no se puede deshacer.`)) return;

    this.busyEliminarId.set(id);

    this.promoSrv
      .eliminar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.noti.exito('Promoción eliminada.');
          this.busyEliminarId.set(null);
          this.promociones.update((lst) => (lst ?? []).filter((x) => this.idRow(x) !== id));
        },
        error: (err) => {
          console.error(err);
          this.busyEliminarId.set(null);
          this.noti.error('No se pudo eliminar la promoción.');
        },
      });
  }

  // =========================
  // Helpers UI
  // =========================
  idRow(row: PromocionData | null | undefined): number | null {
    return (row as any)?.idPromocion ?? null;
  }

  trackById = (_: number, it: PromocionData) => (it as any)?.idPromocion ?? _;

  labelTipo(tipo?: TipoPromocion | string | null): string {
    return labelTipoPromocion(tipo);
  }

  restricciones(row: PromocionData): string[] {
    const out: string[] = [];
    if ((row as any)?.soloNuevos) out.push('Solo nuevos');
    if ((row as any)?.sinCostoInscripcion) out.push('Sin inscripción');
    return out;
  }

  restriccionesTexto(row: PromocionData): string {
    const rs = this.restricciones(row);
    return rs.length ? rs.join(', ') : '—';
  }

  labelBeneficio(row: PromocionData): string {
    const t = (row as any)?.tipo;
    if (t === TipoPromocion.DESCUENTO_PORCENTAJE) return `-${(row as any)?.descuentoPorcentaje ?? 0}%`;
    if (t === TipoPromocion.DESCUENTO_MONTO) return `-$${Number((row as any)?.descuentoMonto ?? 0).toFixed(2)}`;
    if (t === TipoPromocion.MESES_GRATIS) {
      const v = (row as any)?.mesesGratis ?? 0;
      return `+${v} mes${v === 1 ? '' : 'es'}`;
    }
    return '—';
  }

  estadoLabel(row: PromocionData): { texto: string; clase: string } {
    if ((row as any)?.activo === false) return { texto: 'Desactivada', clase: 'bg-slate-100 text-slate-700 ring-slate-200' };

    const hoy = this.hoy();
    const ini = this.toLocalDate((row as any)?.fechaInicio);
    const fin = this.toLocalDate((row as any)?.fechaFin);

    if (!ini || !fin) return { texto: '—', clase: 'bg-slate-100 text-slate-700 ring-slate-200' };
    if (hoy.getTime() < ini.getTime()) return { texto: 'Programada', clase: 'bg-amber-100 text-amber-800 ring-amber-200' };
    if (hoy.getTime() > fin.getTime()) return { texto: 'Vencida', clase: 'bg-rose-100 text-rose-800 ring-rose-200' };
    return { texto: 'Vigente', clase: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
  }

  esVigente(row: PromocionData): boolean {
    if ((row as any)?.activo === false) return false;
    const hoy = this.hoy();
    const ini = this.toLocalDate((row as any)?.fechaInicio);
    const fin = this.toLocalDate((row as any)?.fechaFin);
    if (!ini || !fin) return false;
    return hoy.getTime() >= ini.getTime() && hoy.getTime() <= fin.getTime();
  }

  paqueteLabel(row: PromocionData): string {
    const anyRow: any = row as any;
    const ps: any[] =
      (Array.isArray(anyRow?.paquetes) ? anyRow.paquetes : []) ||
      (anyRow?.paquete ? [anyRow.paquete] : []);
    const paquetes = (ps ?? []).filter(Boolean);
    if (!paquetes.length) return '—';
    if (paquetes.length === 1) {
      const p = paquetes[0];
      return p?.nombre ?? (p?.idPaquete != null ? `Paquete ${p.idPaquete}` : '—');
    }
    return `${paquetes.length} paquetes`;
  }

  promoGymNombre(row: PromocionData): string {
    const g: any = (row as any)?.gimnasio;
    const nombre = (g?.nombre as string | undefined) ?? '';
    if (nombre.trim().length) return nombre.trim();
    const id = (g?.idGimnasio ?? g?.id) as number | undefined;
    return id != null ? `#${id}` : '—';
  }

  private getGymIdFromPromocion(p: PromocionData | null): number | null {
    const anyG: any = (p as any)?.gimnasio;
    const id = (anyG?.idGimnasio ?? anyG?.id) as number | undefined;
    return typeof id === 'number' ? id : null;
  }

  private hoy(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private toLocalDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const s = String(iso).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private rolesDesdeToken(): string[] {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return [];

    try {
      const d: any = this.jwt.decodeToken(raw);
      return [
        ...(Array.isArray(d?.roles) ? d.roles : []),
        ...(Array.isArray(d?.authorities) ? d.authorities : []),
        ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
        d?.role,
        d?.rol,
        d?.perfil,
      ]
        .filter(Boolean)
        .map((r: string) => String(r).toUpperCase());
    } catch {
      return [];
    }
  }

  // =========================
  // Zoom helpers
  // =========================
  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private getDesignWidth(): number {
    return this.mostrarGimnasioCol() ? 1550 : 1400;
  }

  private applyLayout = (): void => {
    this.esXlUp.set(window.matchMedia('(min-width: 1280px)').matches);
    this.es2xlUp.set(window.matchMedia('(min-width: 1536px)').matches);

    const w = this.zoomOuter?.nativeElement?.clientWidth ?? window.innerWidth;

    const design = this.getDesignWidth();
    const z = this.clamp(w / design, this.MIN_ZOOM, this.MAX_ZOOM);
    this.uiZoom = this.round2(z);

    const offset = this.esAdmin() ? 310 : 280;
    const available = window.innerHeight - offset;

    this.promosMaxH = Math.max(420, Math.floor(available / this.uiZoom));
  };

  private layoutScheduled = false;

  private requestLayout(): void {
    if (this.layoutScheduled) return;
    this.layoutScheduled = true;

    Promise.resolve().then(() => {
      this.layoutScheduled = false;

      this.applyLayout();

      try {
        this.cdr.detectChanges();
      } catch {
        // noop
      }
    });
  }
}
