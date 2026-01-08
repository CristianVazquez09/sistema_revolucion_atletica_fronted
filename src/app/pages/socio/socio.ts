import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  Subscription,
  finalize,
  debounceTime,
  distinctUntilChanged,
  map,
  filter,
  switchMap,
  tap,
} from 'rxjs';

import { SocioService } from '../../services/socio-service';
import { SocioData } from '../../model/socio-data';
import { SocioModal } from './socio-modal/socio-modal';
import { Router } from '@angular/router';
import { NotificacionService } from '../../services/notificacion-service';
import { PagedResponse } from '../../model/paged-response';

// Admin: detectar desde token
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import { TipoPaquete } from '../../util/enums/tipo-paquete';
import { MenuService } from 'src/app/services/menu-service';

@Component({
  selector: 'app-socio',
  standalone: true,
  imports: [CommonModule, SocioModal, FormsModule],
  templateUrl: './socio.html',
  styleUrl: './socio.css',
})
export class Socio implements OnInit, OnDestroy {
  // ─────────── Estado de pantalla ───────────
  listaSocios: SocioData[] = [];
  cargando = true;
  mensajeError: string | null = null;

  // Menu
  private menuSrv = inject(MenuService);
  menuAbierto = this.menuSrv.menuAbierto;

  // Admin
  private jwt = inject(JwtHelperService);
  isAdmin = false;

  // Modal
  modalSocioVisible = signal(false);
  socioActual: SocioData | null = null;

  // ─────────── Paginación ───────────
  paginaActual = 0; // 0-based
  tamanioPagina = 10;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [5, 10, 20, 50];

  // ─────────── Búsqueda (con debounce) ───────────
  terminoBusqueda = '';
  private readonly minCaracteresBusqueda = 3;
  private busqueda$ = new Subject<string>();
  private subsBusqueda?: Subscription;
  private destroyRef = inject(DestroyRef);

  // ─────────── Filtro por tipo de paquete vigente ───────────
  // Se maneja como string para que el template esté sencillo: '', 'GIMNASIO', 'ZONA_COMBATE', 'MIXTO'
  filtroTipoPaquete = ''; // '' => todos
  readonly TipoPaquete = TipoPaquete;

  // ─────────── Filtro por estado (activo / inactivo / todos) ───────────
  // Valores: 'ACTIVOS' | 'INACTIVOS' | 'TODOS'
  filtroEstado: 'ACTIVOS' | 'INACTIVOS' | 'TODOS' = 'ACTIVOS';

  constructor(
    private socioService: SocioService,
    private router: Router,
    private notificacion: NotificacionService
  ) {}

  // =========================
  // Helpers de normalización
  // =========================
  private normalizarTermino(v: string): string {
    return (v ?? '')
      .replace(/\u00A0/g, ' ') // NBSP -> espacio normal
      .replace(/\s+/g, ' ')    // colapsa espacios/tabs/saltos
      .trim();
  }

  // ─────────── Ciclo de vida ───────────
  ngOnInit(): void {
    this.isAdmin = this.deducirEsAdminDesdeToken();
    this.cargarSocios();

    this.subsBusqueda = this.busqueda$
      .pipe(
        map((v) => this.normalizarTermino(v)),
        debounceTime(400),
        distinctUntilChanged(),
        tap((texto) => {
          if (texto.length === 0) {
            // limpiar búsqueda -> recargar con filtros normales
            this.paginaActual = 0;
            this.cargarSocios();
          }
        }),
        filter((texto) => texto.length >= this.minCaracteresBusqueda),
        switchMap((texto) => {
          this.cargando = true;
          this.mensajeError = null;
          this.paginaActual = 0;

          const activo = this.mapFiltroEstadoToBoolean();
          const tipoEnum = this.filtroTipoPaquete
            ? (this.filtroTipoPaquete as TipoPaquete)
            : undefined;
          const soloVigentes: boolean | undefined = tipoEnum ? true : undefined;

          return this.socioService
            .buscarSociosPorNombre(
              texto,
              this.paginaActual,
              this.tamanioPagina,
              activo,
              tipoEnum,
              soloVigentes
            )
            .pipe(finalize(() => (this.cargando = false)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
        error: () => {
          this.mensajeError = 'No se pudo ejecutar la búsqueda.';
        },
      });
  }

  ngOnDestroy(): void {
    this.subsBusqueda?.unsubscribe();
  }

  // --- Admin helper
  private deducirEsAdminDesdeToken(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
        ...(Array.isArray(decoded?.realm_access?.roles) ? decoded.realm_access.roles : []),
      ]
        .concat([decoded?.role, decoded?.rol, decoded?.perfil].filter(Boolean) as string[])
        .map((r) => String(r).toUpperCase());

      return decoded?.is_admin === true || roles.includes('ADMIN') || roles.includes('GERENTE');
    } catch {
      return false;
    }
  }

  // ─────────── Helpers de UI (rango mostrado) ───────────
  get rangoDesde(): number {
    if (this.totalElementos === 0) return 0;
    return this.paginaActual * this.tamanioPagina + 1;
  }

  get rangoHasta(): number {
    const hasta = (this.paginaActual + 1) * this.tamanioPagina;
    return Math.min(hasta, this.totalElementos);
  }

  // ─────────── Mapear filtroEstado → boolean para el backend ───────────
  private mapFiltroEstadoToBoolean(): boolean | undefined {
    switch (this.filtroEstado) {
      case 'ACTIVOS':
        return true;
      case 'INACTIVOS':
        return false;
      default:
        return undefined; // 'TODOS'
    }
  }

  // ─────────── Carga y manejo de respuestas ───────────
  private aplicarRespuesta(resp: PagedResponse<SocioData>): void {
    this.listaSocios = resp.contenido ?? [];

    this.totalPaginas = resp.pagina?.totalPaginas ?? 0;
    this.totalElementos = resp.pagina?.totalElementos ?? 0;
    this.tamanioPagina = resp.pagina?.tamanio ?? this.tamanioPagina;
    this.paginaActual = resp.pagina?.numero ?? this.paginaActual;

    if (this.listaSocios.length === 0 && this.paginaActual > 0) {
      this.paginaActual = this.paginaActual - 1;
      this.cargarSocios();
    }
  }

  cargarSocios(): void {
    this.cargando = true;
    this.mensajeError = null;

    const texto = this.normalizarTermino(this.terminoBusqueda);

    const tipoEnum = this.filtroTipoPaquete
      ? (this.filtroTipoPaquete as TipoPaquete)
      : undefined;
    const activo = this.mapFiltroEstadoToBoolean();
    const soloVigentes: boolean | undefined = tipoEnum ? true : undefined;

    const fuente$ =
      texto.length >= this.minCaracteresBusqueda
        ? this.socioService.buscarSociosPorNombre(
            texto,
            this.paginaActual,
            this.tamanioPagina,
            activo,
            tipoEnum,
            soloVigentes
          )
        : this.socioService.buscarSocios(
            this.paginaActual,
            this.tamanioPagina,
            tipoEnum,
            activo
          );

    fuente$.pipe(finalize(() => (this.cargando = false))).subscribe({
      next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
      error: () => {
        this.mensajeError = 'No se pudo cargar la lista de socios.';
      },
    });
  }

  // ─────────── Búsqueda ───────────
  onBuscarChange(valor: string): void {
    const limpio = this.normalizarTermino(valor);
    this.terminoBusqueda = limpio;
    this.busqueda$.next(limpio);
  }

  limpiarBusqueda(): void {
    this.onBuscarChange('');
  }

  // ─────────── Filtro de tipo de paquete ───────────
  cambiarFiltroTipo(valor: string): void {
    if (this.filtroTipoPaquete === valor) return;
    this.filtroTipoPaquete = valor;
    this.paginaActual = 0;
    this.cargarSocios();
  }

  // ─────────── Filtro de estado (activo / inactivo / todos) ───────────
  cambiarFiltroEstado(valor: string): void {
    if (this.filtroEstado === valor) return;
    this.filtroEstado = valor as any;
    this.paginaActual = 0;
    this.cargarSocios();
  }

  // ─────────── Paginación ───────────
  cambiarTamanioPagina(nuevo: number | string): void {
    this.tamanioPagina = Number(nuevo);
    this.paginaActual = 0;
    this.cargarSocios();
  }

  irPrimera(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual = 0;
    this.cargarSocios();
  }

  irAnterior(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual--;
    this.cargarSocios();
  }

  irSiguiente(): void {
    if (this.paginaActual + 1 >= this.totalPaginas) return;
    this.paginaActual++;
    this.cargarSocios();
  }

  irUltima(): void {
    if (this.totalPaginas === 0) return;
    if (this.paginaActual === this.totalPaginas - 1) return;
    this.paginaActual = this.totalPaginas - 1;
    this.cargarSocios();
  }

  // ─────────── Modal ───────────
  abrirModalParaEditar(s: SocioData): void {
    this.socioActual = s;
    this.modalSocioVisible.set(true);
  }

  cerrarModalSocio(): void {
    this.modalSocioVisible.set(false);
  }

  despuesDeGuardarSocio(): void {
    this.cerrarModalSocio();
    this.cargarSocios();
  }

  eliminarSocio(s: SocioData): void {
    if (!s?.idSocio) return;
    if (!confirm(`¿Desactivar al socio "${s.nombre} ${s.apellido}"?`)) return;

    const actualizado: SocioData = { ...s, activo: false };

    this.socioService.actualizar(s.idSocio, actualizado).subscribe({
      next: () => {
        this.notificacion.exito('Socio desactivado.');
        this.cargarSocios();
      },
      error: () => this.notificacion.error('No se pudo desactivar al socio.'),
    });
  }

  verHistorial(s: SocioData): void {
    if (!s?.idSocio) return;
    this.router.navigate(['/pages/socio', s.idSocio, 'historial']);
  }

  verAsesorias(s: SocioData): void {
    if (!s?.idSocio) return;
    this.router.navigate(['/pages/socio', s.idSocio, 'asesorias']);
  }

  // Mostrar gym con tolerancia a id ó idGimnasio
  displayGimnasio(s: SocioData): string {
    const g: any = s?.gimnasio ?? {};
    const nombre = g?.nombre as string | undefined;
    const id = (g?.idGimnasio ?? g?.id) as number | undefined;
    if (nombre && nombre.trim().length) return nombre;
    if (id != null) return `#${id}`;
    return '—';
  }
}
