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

  constructor(
    private socioService: SocioService,
    private router: Router,
    private notificacion: NotificacionService
  ) {}

  // ─────────── Ciclo de vida ───────────
  ngOnInit(): void {
    this.isAdmin = this.deducirEsAdminDesdeToken();
    this.cargarSocios();

    this.subsBusqueda = this.busqueda$
      .pipe(
        map((v) => v.trim()),
        debounceTime(400),
        distinctUntilChanged(),
        tap((texto) => {
          if (texto.length === 0) {
            this.paginaActual = 0;
            this.cargarSocios();
          }
        }),
        filter((texto) => texto.length >= this.minCaracteresBusqueda),
        switchMap((texto) => {
          this.cargando = true;
          this.mensajeError = null;
          this.paginaActual = 0;
          return this.socioService
            .buscarSociosPorNombre(texto, this.paginaActual, this.tamanioPagina)
            .pipe(finalize(() => (this.cargando = false)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
        error: () => { this.mensajeError = 'No se pudo ejecutar la búsqueda.'; },
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
        .map(r => String(r).toUpperCase());

      return decoded?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
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

    const texto = this.terminoBusqueda.trim();
    const fuente$ =
      texto.length >= this.minCaracteresBusqueda
        ? this.socioService.buscarSociosPorNombre(texto, this.paginaActual, this.tamanioPagina)
        : this.socioService.buscarSocios(this.paginaActual, this.tamanioPagina);

    fuente$.pipe(finalize(() => (this.cargando = false))).subscribe({
      next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
      error: () => { this.mensajeError = 'No se pudo cargar la lista de socios.'; },
    });
  }

  // ─────────── Búsqueda ───────────
  onBuscarChange(valor: string): void {
    this.terminoBusqueda = valor;
    this.busqueda$.next(valor);
  }
  limpiarBusqueda(): void {
    this.onBuscarChange('');
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
    if (!confirm(`¿Eliminar al socio "${s.nombre} ${s.apellido}"?`)) return;
    this.socioService.eliminar(s.idSocio).subscribe({
      next: () => this.cargarSocios(),
      error: () => this.notificacion.error('No se pudo eliminar.'),
    });
  }

  verHistorial(s: SocioData): void {
    if (!s?.idSocio) return;
    this.router.navigate(['/pages/socio', s.idSocio, 'historial']);
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
