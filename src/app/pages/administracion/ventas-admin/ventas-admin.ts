import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { VentaService, VentaPageResponse, PageMeta } from '../../../services/venta-service';
import { VentaData } from '../../../model/venta-data';
import { NotificacionService } from '../../../services/notificacion-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { VentasAdminModal } from './ventas-admin-modal/ventas-admin-modal';

@Component({
  selector: 'app-ventas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, VentasAdminModal],
  templateUrl: './ventas-admin.html',
  styleUrl: './ventas-admin.css'
})
export class VentasAdmin {
  private srv  = inject(VentaService);
  private noti = inject(NotificacionService);
  private jwt  = inject(JwtHelperService);

  rows: VentaData[] = [];
  page: PageMeta = { size: 10, number: 0, totalElements: 0, totalPages: 0 };
  cargando = false;
  error: string | null = null;

  sizeSel = 10;
  sortCampo: 'fecha' | 'idVenta' | 'total' = 'fecha';
  sortDir: 'asc' | 'desc' = 'desc';

  esAdmin = false;

  mostrarModal = signal(false);
  idVer: number | null = null;

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
      ].concat([d?.role, d?.rol, d?.perfil].filter(Boolean) as string[]).map(r => String(r).toUpperCase());
      return d?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch { return false; }
  }

  get sortSel(): string { return `${this.sortCampo},${this.sortDir}`; }

  cargar(pageUI: number): void {
    this.error = null;
    this.cargando = true;
    this.srv.listar({ page: pageUI, size: this.sizeSel, sort: this.sortSel })
      .subscribe({
        next: (resp: VentaPageResponse) => {
          this.rows = resp?.content ?? [];
          this.page = resp?.page ?? { size: this.sizeSel, number: (pageUI - 1), totalElements: 0, totalPages: 0 };
          this.cargando = false;
        },
        error: () => {
          this.error = 'No se pudieron cargar las ventas.';
          this.noti.error(this.error);
          this.cargando = false;
        }
      });
  }

  // paginación
  get pageUI(): number { return (this.page?.number ?? 0) + 1; }
  get puedePrev(): boolean { return this.pageUI > 1; }
  get puedeNext(): boolean { return this.pageUI < (this.page?.totalPages ?? 1); }
  prev(): void { if (this.puedePrev) this.cargar(this.pageUI - 1); }
  next(): void { if (this.puedeNext) this.cargar(this.pageUI + 1); }
  go(n: number): void { this.cargar(n); }

  // modal
  ver(v: VentaData): void { this.idVer = v.idVenta ?? null; this.mostrarModal.set(true); }
  cerrarModal(): void { this.mostrarModal.set(false); this.idVer = null; }

  eliminar(v: VentaData): void {
    if (!v?.idVenta) return;
    if (!confirm(`¿Eliminar la venta #${v.idVenta}?`)) return;
    this.srv.eliminar(v.idVenta).subscribe({
      next: () => this.cargar(this.pageUI),
      error: () => this.noti.error('No se pudo eliminar la venta.')
    });
  }

  pagosChip(v: VentaData): string {
    const tot = (tipo: string) =>
      (v.pagos ?? []).filter(p => p.tipoPago === tipo).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);
    const chips: string[] = [];
    const e = tot('EFECTIVO'); if (e > 0) chips.push(`Efectivo ${fmt(e)}`);
    const t = tot('TARJETA');  if (t > 0) chips.push(`Tarjeta ${fmt(t)}`);
    const tr= tot('TRANSFERENCIA'); if (tr > 0) chips.push(`Transf. ${fmt(tr)}`);
    return chips.join(' · ') || '—';
  }

  gymDeVenta(v: VentaData): string {
    // tomamos el gimnasio del producto (o de su categoría)
    const d = v.detalles?.[0];
    const g = d?.producto?.gimnasio ?? d?.producto?.categoria?.gimnasio;
    if (!g) return '—';
    const id = g.idGimnasio ?? g.idGimnasio;
    return g.nombre ?? (id ? `#${id}` : '—');
  }

  trackById = (_: number, it: VentaData) => it.idVenta!;
}
