import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, distinctUntilChanged, skip, Subject, switchMap } from 'rxjs';

import { SocioService } from '../../data/socio-service';
import { SocioData } from '../../../../shared/models/socio-data';
import { SocioModal } from './socio-modal/socio-modal';
import { Router } from '@angular/router';
import { NotificacionService } from '../../../../core/layout/notificacion-service';
import { PagedResponse } from '../../../../shared/models/paged-response';
import { RaBuscador } from 'src/app/shared/ui/ra-buscador/ra-buscador';

import { TipoPaquete } from '../../../../shared/util/enums/tipo-paquete';
import { MenuService } from 'src/app/core/layout/menu-service';
import { RaDropdown } from 'src/app/shared/ui/ra-dropdown/ra-dropdown';
import { RaBadge } from 'src/app/shared/ui/ra-badge/ra-badge';
import { RaTabla } from 'src/app/shared/ui/ra-tabla/ra-tabla';
import { RaPaginador } from 'src/app/shared/ui/ra-paginador/ra-paginador';

// ✅ selector admin + tenant ctx
import { TenantContextService } from 'src/app/core/tenant/tenant-context-service';
import { RaGimnasioFilterComponent } from 'src/app/shared/ui/ra-gimnasio-filter/ra-gimnasio-filter';

// ✅ roles desde token
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-socio',
  standalone: true,
  imports: [
    CommonModule,
    SocioModal,
    FormsModule,
    RaGimnasioFilterComponent,
    RaDropdown,
    RaBadge,
    RaBuscador,
    RaTabla,
    RaPaginador,
  ],
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

  // ✅ Tenant context
  private tenantCtx = inject(TenantContextService);

  // ✅ JWT
  private jwt = inject(JwtHelperService);

  // Admin
  isAdmin = false;

  // ✅ Permisos (Admin + Gerente)
  puedeEditarEliminar = false;

  // Modal
  modalSocioVisible = signal(false);
  socioActual: SocioData | null = null;

  // ─────────── Paginación ───────────
  paginaActual = 0; // 0-based
  tamanioPagina = 10;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [5, 10, 20, 50];

  // ─────────── Búsqueda ───────────
  terminoBusqueda = '';
  private readonly minCaracteresBusqueda = 3;
  private destroyRef = inject(DestroyRef);
  // Subject dedicado a la búsqueda: switchMap cancela la petición HTTP en
  // vuelo si llega un término nuevo antes de que responda el anterior.
  private readonly busquedaSocios$ = new Subject<string>();

  // ─────────── Filtro por tipo de paquete vigente ───────────
  filtroTipoPaquete = ''; // '' => todos
  readonly TipoPaquete = TipoPaquete;

  // ─────────── Filtro por estado (activo / inactivo / todos) ───────────
  filtroEstado: 'ACTIVOS' | 'INACTIVOS' | 'TODOS' = 'ACTIVOS';

  constructor(
    private socioService: SocioService,
    private router: Router,
    private notificacion: NotificacionService,
  ) {
    this.busquedaSocios$
      .pipe(
        switchMap((texto) => {
          const activo = this.mapFiltroEstadoToBoolean();
          const tipoEnum = this.filtroTipoPaquete ? (this.filtroTipoPaquete as TipoPaquete) : undefined;
          const soloVigentes: boolean | undefined = tipoEnum ? true : undefined;
          return this.socioService
            .buscarSociosPorNombre(texto, this.paginaActual, this.tamanioPagina, activo, tipoEnum, soloVigentes)
            .pipe(finalize(() => (this.cargando = false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
        error: () => {
          this.mensajeError = 'No se pudo ejecutar la búsqueda.';
        },
      });
  }

  // =========================
  // Helpers de normalización
  // =========================
  private normalizarTermino(v: string): string {
    return (v ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // =========================
  // ✅ Roles desde token
  // =========================
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

  private tieneRol(roles: string[], ...candidatos: string[]): boolean {
    const set = new Set(roles.map((r) => String(r).toUpperCase()));
    return candidatos.some((c) => set.has(String(c).toUpperCase()));
  }

  // ─────────── Ciclo de vida ───────────
  ngOnInit(): void {
    // ✅ inicializa contexto (admin / tenant)
    this.tenantCtx.initFromToken();
    this.isAdmin = this.tenantCtx.isAdmin;

    // ✅ permisos: Admin y Gerente pueden editar/eliminar
    const roles = this.rolesDesdeToken();
    this.puedeEditarEliminar = this.tieneRol(
      roles,
      'ADMIN',
      'ROLE_ADMIN',
      'GERENTE',
      'ROLE_GERENTE',
    );

    // ✅ Admin: al cambiar gimnasio en selector => recarga lista
    if (this.isAdmin) {
      this.tenantCtx.viewTenantChanges$
        .pipe(distinctUntilChanged(), skip(1), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.paginaActual = 0;
          this.cargarSocios();
        });
    }

    // primera carga
    this.cargarSocios();

    // si venimos desde asistencia con un socio a abrir, abrimos el modal
    const navState = history.state;
    if (navState?.abrirSocioId) {
      this.socioService.buscarPorId(navState.abrirSocioId).subscribe({
        next: (s) => this.abrirModalParaEditar(s),
        error: () => {},
      });
    }
  }

  ngOnDestroy(): void {
    // ✅ si admin eligió un gimnasio aquí, al salir lo regresamos a "Todos"
    if (this.isAdmin) {
      this.tenantCtx.setViewTenant(null);
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

    const tipoEnum = this.filtroTipoPaquete ? (this.filtroTipoPaquete as TipoPaquete) : undefined;
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
            soloVigentes,
          )
        : this.socioService.buscarSocios(this.paginaActual, this.tamanioPagina, tipoEnum, activo);

    fuente$.pipe(finalize(() => (this.cargando = false))).subscribe({
      next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
      error: () => {
        this.mensajeError = 'No se pudo cargar la lista de socios.';
      },
    });
  }

  // ─────────── Búsqueda ───────────
  onBuscarChange(valor: string): void {
    const texto = this.normalizarTermino(valor);
    this.terminoBusqueda = texto;

    if (texto.length === 0) {
      this.paginaActual = 0;
      this.cargarSocios();
      return;
    }

    if (texto.length < this.minCaracteresBusqueda) return;

    this.cargando = true;
    this.mensajeError = null;
    this.paginaActual = 0;

    this.busquedaSocios$.next(texto);
  }

  // ─────────── Filtro de tipo de paquete ───────────
  cambiarFiltroTipo(valor: string): void {
    if (this.filtroTipoPaquete === valor) return;
    this.filtroTipoPaquete = valor;
    this.paginaActual = 0;
    this.cargarSocios();
  }

  // ─────────── Filtro de estado ───────────
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

  irAPaginaSocio(pagina: number): void {
    this.paginaActual = pagina;
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
