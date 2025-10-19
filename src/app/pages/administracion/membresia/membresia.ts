import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MembresiaData } from '../../../model/membresia-data';
import { NotificacionService } from '../../../services/notificacion-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { MembresiaModal } from './membresia-modal/membresia-modal';
import { MembresiaPageResponse, MembresiaService } from '../../../services/membresia-service';

type PageMeta = { size: number; number: number; totalElements: number; totalPages: number; };

@Component({
  selector: 'app-membresia',
  standalone: true,
  imports: [CommonModule, FormsModule, MembresiaModal],
  templateUrl: './membresia.html',
  styleUrl: './membresia.css'
})
export class Membresia {
  private srv  = inject(MembresiaService);
  private noti = inject(NotificacionService);
  private jwt  = inject(JwtHelperService);

  // estado
  rows: MembresiaData[] = [];
  page: PageMeta = { size: 10, number: 0, totalElements: 0, totalPages: 0 };
  cargando = false;
  error: string | null = null;

  // filtros/orden
  sizeSel = 10;
  sortCampo: 'fechaInicio' | 'fechaFin' | 'idMembresia' | 'total' = 'fechaInicio';
  sortDir: 'asc' | 'desc' = 'desc';

  // búsqueda por ID
  idBuscar: number | null = null;
  buscando = false;

  // admin?
  esAdmin = false;

  // modal
  mostrarModal = signal(false);
  idEditando: number | null = null;

  ngOnInit(): void {
    this.esAdmin = this.detectarAdmin();
    this.cargar(1);
  }

  private detectarAdmin(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const d: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(d?.roles) ? d.roles : []),
        ...(Array.isArray(d?.authorities) ? d.authorities : []),
        ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
      ].concat([d?.role, d?.rol, d?.perfil].filter(Boolean) as string[])
       .map(r => String(r).toUpperCase());
      return d?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch { return false; }
  }

  get sortSel(): string { return `${this.sortCampo},${this.sortDir}`; }

  cargar(pageUI: number): void {
    this.error = null;
    this.cargando = true;
    this.srv.listar({ page: pageUI, size: this.sizeSel, sort: this.sortSel })
      .subscribe({
        next: (resp: MembresiaPageResponse) => {
          this.rows = resp?.content ?? [];
          this.page = resp?.page ?? { size: this.sizeSel, number: (pageUI - 1), totalElements: 0, totalPages: 0 };
          this.cargando = false;
        },
        error: () => {
          this.error = 'No se pudieron cargar las membresías.';
          this.noti.error(this.error);
          this.cargando = false;
        }
      });
  }

  /* ========================== Búsqueda por ID ========================== */

  buscarPorId(): void {
    const id = Number(this.idBuscar || 0);
    if (!id) {
      this.limpiarBusqueda(); // si vacío, vuelve a listado
      return;
    }
    this.error = null;
    this.buscando = true;
    this.srv.buscarPorId(id).subscribe({
      next: (m: MembresiaData) => {
        this.rows = [m];
        this.page = { size: 1, number: 0, totalElements: 1, totalPages: 1 };
        this.buscando = false;
      },
      error: () => {
        this.rows = [];
        this.page = { size: 1, number: 0, totalElements: 0, totalPages: 0 };
        this.buscando = false;
        this.error = `No existe la membresía #${id}.`;
        this.noti.error(this.error);
      }
    });
  }

  limpiarBusqueda(): void {
    this.idBuscar = null;
    this.cargar(1);
  }

  /* ============================ Paginación ============================ */

  get pageUI(): number { return (this.page?.number ?? 0) + 1; }
  get puedePrev(): boolean { return this.pageUI > 1; }
  get puedeNext(): boolean { return this.pageUI < (this.page?.totalPages ?? 1); }
  prev(): void { if (this.puedePrev) this.cargar(this.pageUI - 1); }
  next(): void { if (this.puedeNext) this.cargar(this.pageUI + 1); }
  go(n: number): void { this.cargar(n); }

  /* ============================= Acciones ============================= */

  editar(m: MembresiaData): void { this.idEditando = m.idMembresia ?? null; this.mostrarModal.set(true); }
  cerrarModal(): void { this.mostrarModal.set(false); this.idEditando = null; }
  onGuardado(): void { this.cerrarModal(); this.cargar(this.pageUI); }

  eliminar(m: MembresiaData): void {
    if (!m?.idMembresia) return;
    if (!confirm(`¿Eliminar la membresía #${m.idMembresia}?`)) return;
    this.srv.eliminar(m.idMembresia).subscribe({
      next: () => this.cargar(this.pageUI),
      error: () => this.noti.error('No se pudo eliminar la membresía.')
    });
  }

  /* ============================ Helpers UI ============================ */

  pagosChip(m: MembresiaData): string {
    const tot = (tipo: string) =>
      (m.pagos ?? []).filter(p => p.tipoPago === tipo)
        .reduce((a, p) => a + (Number(p.monto) || 0), 0);
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);
    const chips: string[] = [];
    const e = tot('EFECTIVO'); if (e > 0) chips.push(`Efectivo ${fmt(e)}`);
    const t = tot('TARJETA');  if (t > 0) chips.push(`Tarjeta ${fmt(t)}`);
    const tr= tot('TRANSFERENCIA'); if (tr > 0) chips.push(`Transf. ${fmt(tr)}`);
    return chips.join(' · ') || '—';
  }

  gymNombre(g: any): string {
    return g?.nombre ?? (g?.idGimnasio ?? g?.id ? `#${g?.idGimnasio ?? g?.id}` : '—');
  }

  trackById = (_: number, it: MembresiaData) => it.idMembresia!;
}
