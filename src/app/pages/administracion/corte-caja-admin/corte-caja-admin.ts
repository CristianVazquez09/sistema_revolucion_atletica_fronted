import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { CorteCajaService } from '../../../services/corte-caja-service';
import { NotificacionService } from '../../../services/notificacion-service';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { CorteCajaListado, PagedResponse, PageMeta } from '../../../model/corte-caja-data';

type CampoOrden = 'apertura' | 'cierre' | 'idCorte';
type DirOrden   = 'asc' | 'desc';

@Component({
  selector: 'app-corte-caja-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './corte-caja-admin.html',
  styleUrl: './corte-caja-admin.css'
})
export class CorteCajaAdmin {

  private srv  = inject(CorteCajaService);
  private jwt  = inject(JwtHelperService);
  private noti = inject(NotificacionService);

  // Estado tabla
  cortes: CorteCajaListado[] = [];
  page: PageMeta = { size: 10, number: 0, totalElements: 0, totalPages: 0 };
  cargando = false;
  error: string | null = null;

  // Filtros
  estadoSel: '' | 'ABIERTO' | 'CERRADO' = '';
  sizeSel = 10;

  // Ordenamiento mejorado
  sortCampo: 'apertura' | 'cierre' | 'idCorte' = 'apertura';
sortDir: 'asc' | 'desc' = 'desc';
get sortSel(): string { return `${this.sortCampo},${this.sortDir}`; }

  // Admin?
  esAdmin = false;

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

  private buildSort(): string {
    return `${this.sortCampo},${this.sortDir}`;
  }

  // Acciones de ordenamiento (toolbar + encabezados clicables)
  setSortCampo(campo: CampoOrden): void {
    if (this.sortCampo === campo) {
      this.toggleSortDir();       // mismo campo => invierte dirección
    } else {
      this.sortCampo = campo;     // cambia de campo, conserva dirección actual
      this.go(1);
    }
  }
  toggleSortDir(): void {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    this.go(1);
  }
  isCampoActivo(campo: CampoOrden): boolean {
    return this.sortCampo === campo;
  }

  // Carga
  cargar(pageUI: number): void {
    this.error = null;
    this.cargando = true;

    this.srv.listar({
      estado: this.estadoSel,
      page: pageUI,
      size: this.sizeSel,
      sort: this.buildSort()
    })
    .pipe(finalize(() => (this.cargando = false)))
    .subscribe({
      next: (resp: PagedResponse<CorteCajaListado>) => {
        this.cortes = resp?.content ?? [];
        this.page   = resp?.page ?? { size: this.sizeSel, number: (pageUI - 1), totalElements: 0, totalPages: 0 };
      },
      error: () => {
        this.error = 'No se pudieron cargar los cortes.';
        this.noti.error(this.error);
      }
    });
  }

  // Paginación
  get pageUI(): number { return (this.page?.number ?? 0) + 1; }
  get puedePrev(): boolean { return this.pageUI > 1; }
  get puedeNext(): boolean { return this.pageUI < (this.page?.totalPages ?? 1); }

  prev(): void { if (this.puedePrev) this.cargar(this.pageUI - 1); }
  next(): void { if (this.puedeNext) this.cargar(this.pageUI + 1); }
  go(n: number): void { this.cargar(n); }

  // track
  trackById = (_: number, it: CorteCajaListado) => it.idCorte;
}
