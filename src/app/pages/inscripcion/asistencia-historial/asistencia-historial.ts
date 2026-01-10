import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CheckInService } from 'src/app/services/check-in-service';
import { AsistenciaHistorialData } from 'src/app/model/asistencia-historial-data';
import { PagedResponse } from 'src/app/model/paged-response';
import { TiempoPlanLabelPipe } from 'src/app/util/tiempo-plan-label';
import { JwtHelperService } from '@auth0/angular-jwt';
import { MenuService } from 'src/app/services/menu-service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-asistencia-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TiempoPlanLabelPipe],
  templateUrl: './asistencia-historial.html',
  styleUrl: './asistencia-historial.css',
})
export class AsistenciaHistorial implements OnInit {
  private readonly asistenciaService = inject(CheckInService);

  private readonly jwt = inject(JwtHelperService);
  private readonly menuSrv = inject(MenuService);
  private readonly destroyRef = inject(DestroyRef);

  menuAbierto = this.menuSrv.menuAbierto;

  // Admin?
  isAdmin = false;

  // ─────────── Estado ───────────
  listaAsistencias: AsistenciaHistorialData[] = [];
  cargando = true;
  mensajeError: string | null = null;

  // ─────────── Filtros ───────────
  filtroDesde: string | null = null; // 'YYYY-MM-DD'
  filtroHasta: string | null = null; // 'YYYY-MM-DD'
  filtroNombreSocio: string = '';

  // Búsqueda tipo “Socios/Membresías”: debounce + mínimo 3 letras
  private readonly nombreSearch$ = new Subject<string>();
  private buscandoNombre = false;

  private nombreTrim(): string {
    return (this.filtroNombreSocio ?? '').trim();
  }

  private get rangoCompleto(): boolean {
    return !!(this.filtroDesde && this.filtroHasta);
  }

  // nombre listo para backend (≥3)
  private get nombreListo(): boolean {
    return this.nombreTrim().length >= 3;
  }

  // ─────────── Paginación ───────────
  paginaActual = 0; // 0-based
  tamanioPagina = 20;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [10, 20, 50, 100];

  // ─────────── Ciclo de vida ───────────
  ngOnInit(): void {
    this.configurarBusquedaNombre();
    this.cargarAsistencias();
    this.isAdmin = this.deducirEsAdminDesdeToken();
  }

  private configurarBusquedaNombre(): void {
    this.nombreSearch$
      .pipe(
        map((v) => (v ?? '').trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((n) => {
        const activar = n.length >= 3;

        // Si venías buscando por nombre y ahora bajó a < 3 letras:
        // recarga (pero ahora sin nombre; con fechas si están completas)
        if (!activar && this.buscandoNombre) {
          this.buscandoNombre = false;
          this.paginaActual = 0;
          this.cargarAsistencias();
          return;
        }

        // Si ya tiene >= 3 letras: buscar automáticamente
        if (activar) {
          this.buscandoNombre = true;
          this.paginaActual = 0;
          this.cargarAsistencias();
          return;
        }

        // Si quedó vacío: recarga listado normal (o por fechas si están completas)
        if (n.length === 0) {
          this.paginaActual = 0;
          this.cargarAsistencias();
        }
      });
  }

  // ngModelChange del input nombre
  onNombreChange(valor: string): void {
    this.filtroNombreSocio = valor ?? '';
    this.nombreSearch$.next(this.filtroNombreSocio);
  }

  private deducirEsAdminDesdeToken(): boolean {
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
        .concat(
          [decoded?.role, decoded?.rol, decoded?.perfil].filter(Boolean) as string[]
        )
        .map((r) => String(r).toUpperCase());

      return (
        decoded?.is_admin === true ||
        roles.includes('ADMIN') ||
        roles.includes('ROLE_ADMIN')
      );
    } catch {
      return false;
    }
  }

  // ─────────── Rango mostrado ───────────
  get rangoDesde(): number {
    if (this.totalElementos === 0) return 0;
    return this.paginaActual * this.tamanioPagina + 1;
  }

  get rangoHasta(): number {
    const hasta = (this.paginaActual + 1) * this.tamanioPagina;
    return Math.min(hasta, this.totalElementos);
  }

  // ─────────── Eventos UI: filtros ───────────
  aplicarFiltros(): void {
    // Si el nombre está listo (>=3), el botón solo fuerza recarga (ya es automático)
    if (this.nombreListo) {
      this.paginaActual = 0;
      this.cargarAsistencias();
      return;
    }

    // Si hay 1-2 letras, no disparamos búsqueda por nombre
    const n = this.nombreTrim();
    if (n.length > 0 && n.length < 3) {
      this.mensajeError = 'Escribe al menos 3 letras para buscar por nombre.';
      return;
    }

    // Si quiere filtrar por fechas, exige ambas (para no romper backend)
    if ((this.filtroDesde && !this.filtroHasta) || (!this.filtroDesde && this.filtroHasta)) {
      this.mensajeError = 'Para filtrar por fecha debes enviar "desde" y "hasta".';
      return;
    }

    // Si no hay ni nombre listo ni rango completo, recarga todo
    this.paginaActual = 0;
    this.cargarAsistencias();
  }

  limpiarFiltros(): void {
    this.filtroDesde = null;
    this.filtroHasta = null;
    this.filtroNombreSocio = '';
    this.buscandoNombre = false;

    this.paginaActual = 0;
    this.cargarAsistencias();
  }

  // ─────────── Eventos UI: paginación ───────────
  cambiarTamanioPagina(nuevo: number | string): void {
    this.tamanioPagina = Number(nuevo);
    this.paginaActual = 0;
    this.cargarAsistencias();
  }

  irPrimera(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual = 0;
    this.cargarAsistencias();
  }

  irAnterior(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual--;
    this.cargarAsistencias();
  }

  irSiguiente(): void {
    if (this.paginaActual + 1 >= this.totalPaginas) return;
    this.paginaActual++;
    this.cargarAsistencias();
  }

  irUltima(): void {
    if (this.totalPaginas === 0) return;
    if (this.paginaActual === this.totalPaginas - 1) return;
    this.paginaActual = this.totalPaginas - 1;
    this.cargarAsistencias();
  }

  // ─────────── Core de carga ───────────
  private cargarAsistencias(): void {
    this.cargando = true;
    this.mensajeError = null;

    // Solo enviamos nombre si >=3 (para no pegar al backend con 1-2 letras)
    const nombre = this.nombreListo ? this.nombreTrim() : null;

    // Solo enviamos fechas si están ambas
    const desde = this.rangoCompleto ? this.filtroDesde : null;
    const hasta = this.rangoCompleto ? this.filtroHasta : null;

    // Si hay filtros (nombre>=3 o rango completo) => /buscar combinable
    const usarBuscar = !!nombre || (desde && hasta);

    const obs = usarBuscar
      ? this.asistenciaService.buscar(
          this.paginaActual,
          this.tamanioPagina,
          desde,
          hasta,
          nombre
        )
      : this.asistenciaService.listarHistorial(this.paginaActual, this.tamanioPagina);

    obs.subscribe({
      next: (resp: PagedResponse<AsistenciaHistorialData>) => {
        this.aplicarRespuesta(resp);
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.mensajeError = 'No se pudo cargar el historial de asistencias.';
      },
    });
  }

  private aplicarRespuesta(resp: PagedResponse<AsistenciaHistorialData>): void {
    this.listaAsistencias = resp.contenido ?? [];

    this.totalPaginas = resp.pagina?.totalPaginas ?? 0;
    this.totalElementos = resp.pagina?.totalElementos ?? 0;
    this.tamanioPagina = resp.pagina?.tamanio ?? this.tamanioPagina;
    this.paginaActual = resp.pagina?.numero ?? this.paginaActual;

    // Si estás en una página > 0 y ya no hay items, retrocede una página
    if (this.listaAsistencias.length === 0 && this.paginaActual > 0) {
      this.paginaActual = this.paginaActual - 1;
      this.cargarAsistencias();
    }
  }

  // ─────────── Helpers de display ───────────
  displaySocio(a: AsistenciaHistorialData): string {
    if (!a?.socio) return '—';
    const nombre = `${a.socio.nombre ?? ''} ${a.socio.apellido ?? ''}`.trim();
    return nombre || `#${a.socio.idSocio}`;
  }

  displayTelefono(a: AsistenciaHistorialData): string {
    return a?.socio?.telefono || '—';
  }

  displayGimnasio(a: AsistenciaHistorialData): string {
    const g: any = a?.gimnasio ?? {};
    if (g.nombre && String(g.nombre).trim().length) return g.nombre;
    if (g.id != null) return `#${g.id}`;
    return '—';
  }

  displayPaqueteNombre(a: AsistenciaHistorialData): string {
    const p: any = a?.paquete;
    if (p?.nombre && String(p.nombre).trim().length) return p.nombre;
    if (p?.idPaquete != null) return `Paquete #${p.idPaquete}`;
    return '—';
  }

  displayPaqueteDetalle(a: AsistenciaHistorialData): string {
    const p: any = a?.paquete;
    if (!p) return '';

    const parts: string[] = [];
    if (p.tipoPaquete) parts.push(String(p.tipoPaquete));
    if (p.tiempo) parts.push(String(p.tiempo));

    if (p.visitasMaximas != null) parts.push(`Visitas: ${p.visitasMaximas}`);
    if (p.soloFinesDeSemana === true) parts.push('Solo finde');

    return parts.join(' · ');
  }
}
