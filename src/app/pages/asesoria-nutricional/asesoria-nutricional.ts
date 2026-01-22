import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NotificacionService } from 'src/app/services/notificacion-service';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from 'src/environments/environment';

import { MenuService } from 'src/app/services/menu-service';

import { AsesoriaNutricionalService } from 'src/app/services/asesoria-nutricional-service';
import { AsesoriaNutricionalData } from 'src/app/model/asesoria-nutricional-data';

import { AsesoriaNutriocionalModal } from './asesoria-nutriocional-modal/asesoria-nutriocional-modal';

// ✅ enriquecer gimnasio desde el socio real
import { SocioService } from 'src/app/services/socio-service';
import { SocioData } from 'src/app/model/socio-data';

@Component({
  selector: 'app-asesoria-nutricional',
  standalone: true,
  imports: [CommonModule, FormsModule, AsesoriaNutriocionalModal],
  templateUrl: './asesoria-nutricional.html',
  styleUrl: './asesoria-nutricional.css',
})
export class AsesoriaNutricional {
  private destroyRef = inject(DestroyRef);
  private noti = inject(NotificacionService);
  private srv = inject(AsesoriaNutricionalService);
  private socioSrv = inject(SocioService);
  private jwt = inject(JwtHelperService);
  private menuSrv = inject(MenuService);

  menuAbierto = this.menuSrv.menuAbierto;

  @ViewChild('tablaWrap') tablaWrap?: ElementRef<HTMLElement>;
  @ViewChild('zoomOuter', { static: true }) zoomOuter!: ElementRef<HTMLElement>;

  // ✅ solo ADMIN/GERENTE
  puedeVer = false;
  esAdmin = false;
  esGerente = false;

  cargando = false;
  error: string | null = null;

  // ====== Data ======
  listaSig = signal<AsesoriaNutricionalData[]>([]);

  // ====== Un solo filtro ======
  terminoBuscar = '';

  listaFiltradaSig = computed(() => {
    const term = (this.terminoBuscar ?? '').trim().toLowerCase();
    const list = this.listaSig() ?? [];
    if (!term) return list;

    return list.filter((x) => {
      const socio: any = (x as any)?.socio ?? {};
      const nombre = `${socio?.nombre ?? ''} ${socio?.apellido ?? ''}`
        .trim()
        .toLowerCase();
      const tel = String(socio?.telefono ?? '').toLowerCase();
      const idSocio = String(socio?.idSocio ?? '').toLowerCase();
      return nombre.includes(term) || tel.includes(term) || idSocio.includes(term);
    });
  });

  // ====== Modal ======
  mostrarModal = signal(false);
  editando = signal<AsesoriaNutricionalData | null>(null);

  // Busy por fila
  busyDesactivarId = signal<number | null>(null);
  busyEliminarId = signal<number | null>(null);

  // Config “por vencer”
  private readonly UMBRAL_POR_VENCER_DIAS = 3;

  // ✅ cache: idSocio -> SocioData (con gimnasio)
  private socioCache = new Map<number, SocioData>();

  // ====== Zoom / Layout (igual a Membresías) ======
  uiZoom = 1;
  asesoriasMaxH = 650;

  private ro?: ResizeObserver;

  private readonly MIN_ZOOM = 0.72;
  private readonly MAX_ZOOM = 1.0;

  esXlUp = signal(
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1280px)').matches
      : false
  );

  es2xlUp = signal(
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1536px)').matches
      : false
  );

  // ✅ Mostrar gimnasio solo si:
  // - es admin
  // - y (2XL+ OR menú cerrado)
  mostrarGimnasioCol = computed(() => {
    if (!this.esAdmin) return false;
    return this.es2xlUp() || !this.menuAbierto();
  });

  ngOnInit(): void {
    const roles = this.rolesDesdeToken();
    this.esAdmin = roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    this.esGerente = roles.includes('GERENTE') || roles.includes('ROLE_GERENTE');

    this.puedeVer = this.esAdmin || this.esGerente;
    if (!this.puedeVer) {
      this.error = 'No autorizado.';
      return;
    }

    this.cargar();
  }

  ngAfterViewInit(): void {
    this.applyLayout();

    this.ro = new ResizeObserver(() => this.applyLayout());
    this.ro.observe(this.zoomOuter.nativeElement);

    window.addEventListener('resize', this.applyLayout);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    window.removeEventListener('resize', this.applyLayout);
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

  // ====== Cargar (SIN paginación) ======
  cargar(): void {
    this.cargando = true;
    this.error = null;

    this.srv
      .buscarTodos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const list = Array.isArray(data) ? data : [];
          this.listaSig.set(list);
          this.cargando = false;

          // ✅ IMPORTANTE: siempre parchea gimnasio (aunque ya esté en cache)
          this.enriquecerSociosConGimnasio(list);
        },
        error: (err) => {
          console.error(err);
          this.cargando = false;
          this.error = 'No se pudieron cargar las asesorías nutricionales.';

          // ✅ FIX TS: no pasar null
          const msg = this.error || 'No se pudieron cargar las asesorías nutricionales.';
          this.noti.error(msg);
        },
      });
  }

  // =============================
  // Enriquecer socio.gimnasio
  // - Parchea SIEMPRE la lista usando cache.
  // - Si faltan socios en cache, primero los trae y luego parchea.
  // =============================
  private enriquecerSociosConGimnasio(list: AsesoriaNutricionalData[]): void {
    const ids = Array.from(
      new Set(
        (list ?? [])
          .map((r) => Number(((r as any)?.socio as any)?.idSocio ?? 0))
          .filter((id) => !!id)
      )
    );

    if (!ids.length) return;

    const patchFromCache = (): void => {
      const curr = this.listaSig() ?? [];

      const next = curr.map((row) => {
        const socio0: any = (row as any)?.socio ?? null;
        const idSocio = Number(socio0?.idSocio ?? 0);
        if (!idSocio) return row;

        const full = this.socioCache.get(idSocio) as any;
        if (!full) return row;

        // ✅ copiar objetos para que Angular repinte (evita “desaparece gimnasio”)
        const socio = { ...(socio0 ?? {}) };

        // ✅ copiar gimnasio al socio embebido si viene “mocho”
        if (!socio.gimnasio && full?.gimnasio) socio.gimnasio = full.gimnasio;

        // fallbacks por si tu backend manda nombre suelto
        if (!socio.gimnasioNombre && full?.gimnasio?.nombre)
          socio.gimnasioNombre = full.gimnasio.nombre;

        if (!socio.nombreGimnasio && full?.gimnasio?.nombre)
          socio.nombreGimnasio = full.gimnasio.nombre;

        return { ...(row as any), socio };
      });

      this.listaSig.set(next);
    };

    const faltan = ids.filter((id) => !this.socioCache.has(id));

    // Si no falta nadie, igual parcheamos (porque la lista nueva puede venir sin gimnasio)
    if (!faltan.length) {
      patchFromCache();
      return;
    }

    forkJoin(
      faltan.map((id) =>
        this.socioSrv.buscarPorId(id).pipe(
          catchError((err) => {
            console.error('No se pudo cargar socio', id, err);
            return of(null as any);
          })
        )
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sociosFull: (SocioData | null)[]) => {
        for (const s of sociosFull) {
          if (s?.idSocio) this.socioCache.set(Number(s.idSocio), s);
        }

        patchFromCache();
      });
  }

  // ====== Modal ======
  abrirNuevo(): void {
    this.editando.set(null);
    this.mostrarModal.set(true);
  }

  abrirEditar(row: AsesoriaNutricionalData): void {
    this.editando.set(row);
    this.mostrarModal.set(true);
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.editando.set(null);
  }

  onGuardado(): void {
    this.cerrarModal();
    this.cargar();
  }

  limpiarFiltro(): void {
    this.terminoBuscar = '';
  }

  // -----------------------------
  // Helpers ID
  // -----------------------------
  idRow(row: AsesoriaNutricionalData): number {
    const anyRow: any = row as any;
    return Number(
      anyRow?.id ?? anyRow?.idAsesoria ?? anyRow?.idAsesoriaNutricional ?? 0
    );
  }

  private removeRow(id: number): void {
    const curr = this.listaSig() ?? [];
    this.listaSig.set(curr.filter((r) => this.idRow(r) !== id));
  }

  // -----------------------------
  // Gimnasio label (igual idea Membresías)
  // -----------------------------
  gimnasioLabelFromSocio(socio: any): string {
    if (!socio) return '—';

    const g: any = socio?.gimnasio ?? null;
    const nombreObj = String(g?.nombre ?? '').trim();
    const idObj = g?.idGimnasio ?? g?.id;

    const nombre1 = String(socio?.gimnasioNombre ?? '').trim();
    const nombre2 = String(socio?.nombreGimnasio ?? '').trim();
    const strGym =
      typeof socio?.gimnasio === 'string' ? String(socio.gimnasio).trim() : '';

    if (nombreObj) return nombreObj;
    if (nombre1) return nombre1;
    if (nombre2) return nombre2;
    if (strGym) return strGym;

    if (idObj != null) return `#${idObj}`;
    return '—';
  }

  gimnasioLabel(row: AsesoriaNutricionalData): string {
    const socio: any = (row as any)?.socio;
    return this.gimnasioLabelFromSocio(socio);
  }

  // -----------------------------
  // Fechas (sin bug de timezone)
  // -----------------------------
  private hoyLocal(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private parseISODateLocal(iso?: string | null): Date | null {
    if (!iso) return null;
    const parts = String(iso).split('-').map((n) => Number(n));
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private diffDays(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.floor(ms / 86400000);
  }

  // Para pintar dd/MM/yyyy desde "YYYY-MM-DD"
  fmt(iso?: string | null): string {
    if (!iso) return '—';
    const d = this.parseISODateLocal(iso);
    if (!d) return String(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }

  // -----------------------------
  // Estado / Vigencia
  // -----------------------------
  esDesactivada(row: AsesoriaNutricionalData): boolean {
    return (row as any)?.activo === false;
  }

  estaProgramada(row: AsesoriaNutricionalData): boolean {
    if (this.esDesactivada(row)) return false;
    const hoy = this.hoyLocal();
    const ini = this.parseISODateLocal((row as any)?.fechaInicio);
    const fin = this.parseISODateLocal((row as any)?.fechaFin);
    if (!ini || !fin) return false;
    return hoy < ini;
  }

  estaVencida(row: AsesoriaNutricionalData): boolean {
    if (this.esDesactivada(row)) return false;
    const hoy = this.hoyLocal();
    const fin = this.parseISODateLocal((row as any)?.fechaFin);
    if (!fin) return false;
    return hoy > fin;
  }

  estaVigente(row: AsesoriaNutricionalData): boolean {
    if (this.esDesactivada(row)) return false;
    const hoy = this.hoyLocal();
    const ini = this.parseISODateLocal((row as any)?.fechaInicio);
    const fin = this.parseISODateLocal((row as any)?.fechaFin);
    if (!ini || !fin) return false;
    return hoy >= ini && hoy <= fin;
  }

  estaPorVencer(row: AsesoriaNutricionalData): boolean {
    if (!this.estaVigente(row)) return false;
    const hoy = this.hoyLocal();
    const fin = this.parseISODateLocal((row as any)?.fechaFin);
    if (!fin) return false;
    const dias = this.diffDays(hoy, fin);
    return dias >= 0 && dias <= this.UMBRAL_POR_VENCER_DIAS;
  }

  puedeDesactivar(row: AsesoriaNutricionalData): boolean {
    return !this.esDesactivada(row);
  }

  // -----------------------------
  // Acciones: Desactivar / Eliminar
  // -----------------------------
  desactivar(row: AsesoriaNutricionalData): void {
    const id = this.idRow(row);
    if (!id) return;

    if (!this.puedeDesactivar(row)) {
      this.noti.info?.('Esta asesoría ya está desactivada.');
      return;
    }

    if (!confirm('¿Desactivar asesoría nutricional?')) return;

    this.busyDesactivarId.set(id);

    this.srv
      .desactivar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.noti.exito('Asesoría desactivada.');
          this.busyDesactivarId.set(null);
          this.cargar();
        },
        error: (err) => {
          console.error(err);
          this.busyDesactivarId.set(null);
          this.noti.error('No se pudo desactivar.');
        },
      });
  }

  eliminar(row: AsesoriaNutricionalData): void {
    const id = this.idRow(row);
    if (!id) return;

    if (
      !confirm(
        '¿Eliminar asesoría nutricional? Esta acción no se puede deshacer.'
      )
    )
      return;

    this.busyEliminarId.set(id);

    this.srv
      .eliminar(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeRow(id);
          this.noti.exito('Asesoría eliminada.');
          this.busyEliminarId.set(null);
          this.cargar();
        },
        error: (err) => {
          console.error(err);
          this.busyEliminarId.set(null);
          this.noti.error('No se pudo eliminar.');
        },
      });
  }

  // ====== Layout (zoom + maxHeight) ======
  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private getDesignWidth(): number {
    // Con gimnasio visible requiere más ancho
    return this.mostrarGimnasioCol() ? 1700 : 1500;
  }

  private applyLayout = (): void => {
    this.esXlUp.set(window.matchMedia('(min-width: 1280px)').matches);
    this.es2xlUp.set(window.matchMedia('(min-width: 1536px)').matches);

    const w = this.zoomOuter.nativeElement.clientWidth;

    const design = this.getDesignWidth();
    const z = this.clamp(w / design, this.MIN_ZOOM, this.MAX_ZOOM);
    this.uiZoom = this.round2(z);

    // Ajuste similar a Membresías
    const offset = this.esAdmin ? 330 : 320;
    const available = window.innerHeight - offset;

    this.asesoriasMaxH = Math.max(420, Math.floor(available / this.uiZoom));
  };
}
