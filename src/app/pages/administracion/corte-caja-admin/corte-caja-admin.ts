import {
  Component,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, distinctUntilChanged, skip } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CorteCajaService } from '../../../services/corte-caja-service';
import { NotificacionService } from '../../../services/notificacion-service';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { CorteCajaListado, PagedResponse, PageMeta } from '../../../model/corte-caja-data';
import { TicketService } from '../../../services/ticket-service';
import { CorteCajaInfo } from './corte-caja-info/corte-caja-info';

// ✅ tenant selector
import { TenantContextService } from 'src/app/core/tenant-context.service';
import { RaGimnasioFilterComponent } from 'src/app/shared/ra-app-zoom/ra-gimnasio-filter/ra-gimnasio-filter';

type CampoOrden = 'apertura' | 'cierre' | 'idCorte';
type DirOrden   = 'asc' | 'desc';

@Component({
  selector: 'app-corte-caja-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, CorteCajaInfo, RaGimnasioFilterComponent],
  templateUrl: './corte-caja-admin.html',
  styleUrl: './corte-caja-admin.css'
})
export class CorteCajaAdmin {

  private srv    = inject(CorteCajaService);
  private jwt    = inject(JwtHelperService);
  private noti   = inject(NotificacionService);
  private ticket = inject(TicketService);

  // ✅ tenant ctx
  private tenantCtx = inject(TenantContextService);
  private destroyRef = inject(DestroyRef);
  private destroying = false;

  // Estado tabla
  cortes: CorteCajaListado[] = [];
  page: PageMeta = { size: 10, number: 0, totalElements: 0, totalPages: 0 };
  cargando = false;
  error: string | null = null;

  // Filtros
  estadoSel: '' | 'ABIERTO' | 'CERRADO' = '';
  sizeSel = 10;

  // Ordenamiento
  sortCampo: CampoOrden = 'apertura';
  sortDir: DirOrden = 'desc';
  get sortSel(): string { return `${this.sortCampo},${this.sortDir}`; }

  // Admin / permisos
  esAdmin = false;

  // Reimpresión
  reimprimiendo = false;

  // Modal de información
  mostrarInfo = false;
  corteSeleccionado: CorteCajaListado | null = null;

  ngOnInit(): void {
    // ✅ igual que Membresías/Ventas
    this.tenantCtx.initFromToken();
    this.esAdmin = this.tenantCtx.isAdmin;

    if (this.esAdmin) {
      this.tenantCtx.viewTenantChanges$
        .pipe(
          distinctUntilChanged(),
          skip(1),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => {
          if (this.destroying) return;
          this.cargar(1);
        });
    }

    this.cargar(1);
  }

  ngOnDestroy(): void {
    this.destroying = true;

    // ✅ CLAVE: reset a "Todos" al salir para no dejar filtro pegado
    if (this.esAdmin) {
      this.tenantCtx.setViewTenant(null);
    }
  }

  // (opcional) lo dejo por si lo usas en otro lado, pero ya no se usa para esAdmin
  private detectarAdmin(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const d: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(d?.roles) ? d.roles : []),
        ...(Array.isArray(d?.authorities) ? d.authorities : []),
        ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
      ]
        .concat([d?.role, d?.rol, d?.perfil].filter(Boolean) as string[])
        .map(r => String(r).toUpperCase());
      return d?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch {
      return false;
    }
  }

  private buildSort(): string {
    return `${this.sortCampo},${this.sortDir}`;
  }

  // Acciones de ordenamiento (encabezados clicables)
  setSortCampo(campo: CampoOrden): void {
    if (this.sortCampo === campo) {
      this.toggleSortDir();
    } else {
      this.sortCampo = campo;
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
      sort: this.buildSort(),
    })
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp: PagedResponse<CorteCajaListado>) => {
          this.cortes = resp?.content ?? [];
          this.page   = resp?.page ?? {
            size: this.sizeSel,
            number: (pageUI - 1),
            totalElements: 0,
            totalPages: 0,
          };
        },
        error: () => {
          this.error = 'No se pudieron cargar los cortes.';
          this.noti.error(this.error);
        },
      });
  }

  // Paginación
  get pageUI(): number { return (this.page?.number ?? 0) + 1; }
  get puedePrev(): boolean { return this.pageUI > 1; }
  get puedeNext(): boolean { return this.pageUI < (this.page?.totalPages ?? 1); }

  prev(): void { if (this.puedePrev) this.cargar(this.pageUI - 1); }
  next(): void { if (this.puedeNext) this.cargar(this.pageUI + 1); }
  go(n: number): void { this.cargar(n); }

  // Reimprimir ticket de corte
  reimprimir(c: CorteCajaListado): void {
    if (!c?.idCorte || this.reimprimiendo) return;

    if (c.estado !== 'CERRADO') {
      this.noti.aviso?.('Solo puedes reimprimir tickets de cortes cerrados.');
      return;
    }

    this.reimprimiendo = true;

    const gym: any = c.gimnasio || {};
    const ctx = {
      negocio: {
        nombre: gym?.nombre || 'Gimnasio',
        direccion: gym?.direccion,
        telefono: gym?.telefono,
      },
      brandTitle: 'REVOLUCIÓN ATLÉTICA',
    } as const;

    this.srv.consultar(c.idCorte)
      .pipe(finalize(() => (this.reimprimiendo = false)))
      .subscribe({
        next: (detalle) => {
          this.ticket.imprimirCorteDesdeBackend(detalle as any, ctx);
          this.noti.info(`Ticket de corte #${c.idCorte} enviado a impresión.`);
        },
        error: (err) => {
          console.error('[CorteCajaAdmin] Error al consultar detalle de corte', err);
          this.noti.error('No se pudo obtener el detalle del corte para reimprimir.');
        },
      });
  }

  // Abrir / cerrar modal de información
  verInfo(c: CorteCajaListado): void {
    this.corteSeleccionado = c;
    this.mostrarInfo = true;
  }

  cerrarInfo(): void {
    this.mostrarInfo = false;
    this.corteSeleccionado = null;
  }

  // track
  trackById = (_: number, it: CorteCajaListado) => it.idCorte;
}
