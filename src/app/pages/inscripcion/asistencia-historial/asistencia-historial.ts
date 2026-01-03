import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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

  private jwt = inject(JwtHelperService);
    private menuSrv = inject(MenuService);
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
  filtroIdSocio: number | null = null;

  get usandoRango(): boolean {
    return !!(this.filtroDesde && this.filtroHasta);
  }

  // ─────────── Paginación ───────────
  paginaActual = 0; // 0-based
  tamanioPagina = 20;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [10, 20, 50, 100];

  // ─────────── Ciclo de vida ───────────
  ngOnInit(): void {
    this.cargarAsistencias();
    this.isAdmin = this.deducirEsAdminDesdeToken();
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
            [decoded?.role, decoded?.rol, decoded?.perfil].filter(
              Boolean
            ) as string[]
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
    if (!this.filtroDesde || !this.filtroHasta) {
      this.mensajeError = 'Selecciona fecha desde y hasta.';
      return;
    }
    this.paginaActual = 0;
    this.cargarAsistencias();
  }

  limpiarFiltros(): void {
    this.filtroDesde = null;
    this.filtroHasta = null;
    this.filtroIdSocio = null;
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

    const obs = this.usandoRango
      ? this.asistenciaService.listarHistorialRango(
          this.paginaActual,
          this.tamanioPagina,
          this.filtroDesde!, // no null si usandoRango
          this.filtroHasta!,
          this.filtroIdSocio && this.filtroIdSocio > 0 ? this.filtroIdSocio : undefined
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

  // NUEVO
  displayPaqueteNombre(a: AsistenciaHistorialData): string {
    const p: any = a?.paquete;
    if (p?.nombre && String(p.nombre).trim().length) return p.nombre;
    if (p?.idPaquete != null) return `Paquete #${p.idPaquete}`;
    return '—';
  }

  // NUEVO: detalle tipo/tiempo (si viene)
  displayPaqueteDetalle(a: AsistenciaHistorialData): string {
    const p: any = a?.paquete;
    if (!p) return '';

    const parts: string[] = [];
    if (p.tipoPaquete) parts.push(String(p.tipoPaquete));
    if (p.tiempo) parts.push(String(p.tiempo));

    // visitas / fines de semana (si quieres mostrarlo)
    if (p.visitasMaximas != null) parts.push(`Visitas: ${p.visitasMaximas}`);
    if (p.soloFinesDeSemana === true) parts.push('Solo finde');

    return parts.join(' · ');
  }
}
