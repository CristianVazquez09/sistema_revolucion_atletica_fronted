import {
  Component,
  ElementRef,
  inject,
  signal,
  ViewChild,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { VentaService, VentaPageResponse, PageMeta } from '../../../services/venta-service';
import { VentaData } from '../../../model/venta-data';
import { NotificacionService } from '../../../services/notificacion-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { VentasAdminModal } from './ventas-admin-modal/ventas-admin-modal';
import { TicketService, TicketPagoDetalle } from 'src/app/services/ticket-service';
import { MenuService } from 'src/app/services/menu-service';

// ✅ tenant selector + recarga reactiva
import { TenantContextService } from 'src/app/core/tenant-context.service';
import { RaGimnasioFilterComponent } from 'src/app/shared/ra-app-zoom/ra-gimnasio-filter/ra-gimnasio-filter';
import { distinctUntilChanged, skip } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-ventas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, VentasAdminModal, RaGimnasioFilterComponent],
  templateUrl: './ventas-admin.html',
  styleUrl: './ventas-admin.css'
})
export class VentasAdmin {
  // --- inyección de servicios ---
  private srv    = inject(VentaService);
  private noti   = inject(NotificacionService);
  private jwt    = inject(JwtHelperService);
  private ticket = inject(TicketService);
  private menuSrv = inject(MenuService);

  // ✅ tenant ctx
  private tenantCtx = inject(TenantContextService);
  private destroyRef = inject(DestroyRef);
  private destroying = false;

  menuAbierto = this.menuSrv.menuAbierto;

  // --- estado de tabla/paginación ---
  rows: VentaData[] = [];
  page: PageMeta = { size: 10, number: 0, totalElements: 0, totalPages: 0 };
  cargando = false;
  error: string | null = null;

  // --- filtros/orden ---
  sizeSel = 10;
  sortCampo: 'fecha' | 'idVenta' | 'total' | 'folio' = 'fecha';
  sortDir: 'asc' | 'desc' = 'desc';

  // --- auth / roles ---
  esAdmin = false;
  esRecep = false;
  reimprimiendo = false;

  // --- modal ---
  mostrarModal = signal(false);
  idVer: number | null = null;

  // --- búsqueda por folio ---
  folioBuscar: string = '';
  buscandoPorFolio = false;

  // --- filtro por rango de fechas ---
  fechaDesde: string = ''; // 'YYYY-MM-DD'
  fechaHasta: string = ''; // 'YYYY-MM-DD'
  buscandoPorRango = false;

  // =========================
  // ZOOM
  // =========================
  @ViewChild('zoomOuter', { static: true }) zoomOuter!: ElementRef<HTMLElement>;
  uiZoom = 1;
  ventasMaxH = 650;
  private ro?: ResizeObserver;

  private readonly MIN_ZOOM = 0.67;
  private readonly MAX_ZOOM = 1.0;

  // ============= Ciclo de vida =============
  ngOnInit(): void {
    // ✅ Inicializa tenant desde token (admin/no admin)
    this.tenantCtx.initFromToken();
    this.esAdmin = this.tenantCtx.isAdmin;

    // roles extra para recep
    const roles = this.rolesDesdeToken();
    this.esRecep = roles.includes('RECEPCIONISTA') || roles.includes('ROLE_RECEPCIONISTA');

    // ✅ Admin: al cambiar gimnasio en el selector => recargar
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

  ngAfterViewInit(): void {
    this.applyLayout();

    this.ro = new ResizeObserver(() => this.applyLayout());
    this.ro.observe(this.zoomOuter.nativeElement);

    window.addEventListener('resize', this.applyLayout);
  }

  ngOnDestroy(): void {
    this.destroying = true;

    this.ro?.disconnect();
    window.removeEventListener('resize', this.applyLayout);

    // ✅ CLAVE: al salir, reset a "Todos" para no dejar filtro pegado en otros módulos
    if (this.esAdmin) {
      this.tenantCtx.setViewTenant(null);
    }
  }

  // ============= Helpers roles =============
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
        d?.perfil
      ]
        .filter(Boolean)
        .map((r: string) => String(r).toUpperCase());
    } catch {
      return [];
    }
  }

  get sortSel(): string { return `${this.sortCampo},${this.sortDir}`; }

  // ============= Carga / paginación =============
  cargar(pageUI: number): void {
    this.error = null;

    if (this.buscandoPorRango && this.fechaDesde && this.fechaHasta) {
      this.cargando = true;
      this.srv.listarPorRango({
        desde: this.fechaDesde,
        hasta: this.fechaHasta,
        page: pageUI,
        size: this.sizeSel,
        sort: this.sortSel
      }).subscribe({
        next: (resp: VentaPageResponse) => {
          this.rows = resp?.content ?? [];
          this.page = resp?.page ?? {
            size: this.sizeSel,
            number: (pageUI - 1),
            totalElements: 0,
            totalPages: 0
          };
          this.cargando = false;
        },
        error: () => {
          this.error = 'No se pudieron cargar las ventas del rango.';
          this.noti.error(this.error);
          this.cargando = false;
        }
      });
      return;
    }

    if (this.buscandoPorFolio) {
      this.buscarPorFolio();
      return;
    }

    this.cargando = true;
    this.srv.listar({ page: pageUI, size: this.sizeSel, sort: this.sortSel })
      .subscribe({
        next: (resp: VentaPageResponse) => {
          this.rows = resp?.content ?? [];
          this.page = resp?.page ?? {
            size: this.sizeSel,
            number: (pageUI - 1),
            totalElements: 0,
            totalPages: 0
          };
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

  // ============= Búsqueda por folio =============
  buscarPorFolio(): void {
    const folio = Number(this.folioBuscar);
    if (!folio || isNaN(folio) || folio <= 0) {
      this.noti.error('Ingresa un folio válido.');
      return;
    }

    this.cargando = true;
    this.error = null;

    this.srv.buscarPorFolio(folio).subscribe({
      next: (venta) => {
        this.rows = venta ? [venta] : [];
        this.page = { size: 1, number: 0, totalElements: this.rows.length, totalPages: 1 };
        this.buscandoPorFolio = true;
        this.buscandoPorRango = false;
        this.cargando = false;

        if (!venta) this.noti.error(`No se encontró la venta con folio #${folio}.`);
      },
      error: () => {
        this.cargando = false;
        this.rows = [];
        this.page = { size: 1, number: 0, totalElements: 0, totalPages: 1 };
        this.buscandoPorFolio = true;
        this.buscandoPorRango = false;
        this.noti.error(`No se encontró la venta con folio #${folio}.`);
      }
    });
  }

  // ============= Búsqueda por rango de fechas =============
  buscarPorRango(): void {
    if (!this.fechaDesde || !this.fechaHasta) {
      this.noti.error('Selecciona la fecha "desde" y "hasta".');
      return;
    }
    if (this.fechaHasta < this.fechaDesde) {
      this.noti.error('La fecha "hasta" no puede ser menor que la fecha "desde".');
      return;
    }

    this.buscandoPorRango = true;
    this.buscandoPorFolio = false;
    this.cargar(1);
  }

  limpiarBusqueda(): void {
    this.folioBuscar = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.buscandoPorFolio = false;
    this.buscandoPorRango = false;
    this.cargar(1);
  }

  // ============= Modal =============
  ver(v: VentaData): void {
    this.idVer = v.idVenta ?? null;
    this.mostrarModal.set(true);
  }
  cerrarModal(): void { this.mostrarModal.set(false); this.idVer = null; }

  onGuardado(venta: VentaData) {
    this.noti.exito?.('Venta actualizada.');

    if (this.buscandoPorFolio && venta?.folio === Number(this.folioBuscar || 0)) {
      this.rows = [venta];
      this.page = { size: 1, number: 0, totalElements: 1, totalPages: 1 };
      this.cerrarModal();
      return;
    }

    if (this.buscandoPorRango) {
      this.cargar(this.pageUI);
      this.cerrarModal();
      return;
    }

    this.cargar(this.pageUI);
    this.cerrarModal();
  }

  // ============= Acciones tabla =============
  eliminar(v: VentaData): void {
    if (this.esRecep) return;
    if (!v?.idVenta) return;
    if (!confirm(`¿Eliminar la venta #${v.folio ?? v.idVenta}?`)) return;
    this.srv.eliminar(v.idVenta).subscribe({
      next: () => this.cargar(this.pageUI),
      error: () => this.noti.error('No se pudo eliminar la venta.')
    });
  }

  reimprimir(v: VentaData): void {
    if (!v?.idVenta || this.reimprimiendo) return;

    this.reimprimiendo = true;

    const g = this.gimnasioObjDeVenta(v) || {};
    const negocio = {
      nombre: (g as any).nombre || 'Gimnasio',
      direccion: (g as any).direccion,
      telefono: (g as any).telefono,
    };

    const cajero = v.usuario?.nombreUsuario || '';

    const socioNombre = (
      `${(v as any).socio?.nombre ?? (v as any).cliente?.nombre ?? ''} ` +
      `${(v as any).socio?.apellido ?? (v as any).cliente?.apellido ?? ''}`
    ).trim();

    const pagos: TicketPagoDetalle[] | undefined =
      (v.pagos && v.pagos.length)
        ? v.pagos.map(p => ({
            metodo: (p as any).tipoPago,
            monto: Number((p as any).monto) || 0,
          }))
        : undefined;

    try {
      this.ticket.imprimirVentaDesdeBackend(
        v as any,
        { negocio, cajero, socio: socioNombre || undefined },
        undefined,
        pagos
      );
      this.noti.info(`Ticket de venta #${v.folio ?? v.idVenta} enviado a impresión.`);
    } catch (e) {
      console.error(e);
      this.noti.error('No se pudo reimprimir el ticket de la venta.');
    } finally {
      this.reimprimiendo = false;
    }
  }

  pagosChip(v: VentaData): string {
    const tot = (tipo: string) =>
      (v.pagos ?? [])
        .filter(p => p.tipoPago === tipo)
        .reduce((a, p) => a + (Number(p.monto) || 0), 0);

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2
      }).format(n);

    const chips: string[] = [];
    const e = tot('EFECTIVO');       if (e > 0) chips.push(`Efectivo ${fmt(e)}`);
    const t = tot('TARJETA');        if (t > 0) chips.push(`Tarjeta ${fmt(t)}`);
    const tr = tot('TRANSFERENCIA'); if (tr > 0) chips.push(`Transf. ${fmt(tr)}`);
    return chips.join(' · ') || '—';
  }

  // ==========================
  // Productos
  // ==========================
  productosDeVenta(v: any): string[] {
    const dets = (v?.detalles ?? v?.detalle ?? v?.items ?? []) as any[];
    if (!Array.isArray(dets) || dets.length === 0) return [];

    const map = new Map<string, number>();

    for (const d of dets) {
      const nombre = (d?.producto?.nombre ?? d?.nombreProducto ?? '').toString().trim();
      if (!nombre) continue;

      const qtyRaw = d?.cantidad ?? 1;
      const qty = Number.isFinite(+qtyRaw) ? Math.max(1, +qtyRaw) : 1;

      map.set(nombre, (map.get(nombre) ?? 0) + qty);
    }

    return Array.from(map.entries()).map(([nombre, qty]) => (qty > 1 ? `${nombre} x${qty}` : nombre));
  }

  productoTitleCompleto(v: any): string {
    const ps = this.productosDeVenta(v);
    return ps.length ? ps.join(' | ') : '';
  }

  // ==========================
  // Gimnasio
  // ==========================
  private gimnasioObjDeVenta(v: VentaData): any {
    return (v as any).gimnasio
      ?? v.detalles?.[0]?.producto?.gimnasio
      ?? v.detalles?.[0]?.producto?.categoria?.gimnasio;
  }

  gymDeVenta(v: VentaData): string {
    const g = this.gimnasioObjDeVenta(v);
    if (!g) return '—';
    const id = (g as any).idGimnasio ?? (g as any).id;
    return (g as any).nombre ?? (id ? `#${id}` : '—');
  }

  trackById = (_: number, it: VentaData) => it.idVenta!;

  // ==========================
  // Layout
  // ==========================
  private clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private getDesignWidth(): number {
    const menu = this.menuAbierto(); // signal
    if (this.esAdmin) return menu ? 1550 : 1800;
    return menu ? 1450 : 1700;
  }

  private applyLayout = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      this.uiZoom = 1;

      const top = this.zoomOuter.nativeElement.getBoundingClientRect().top;
      const bottomReserve = 140;
      const available = window.innerHeight - top - bottomReserve;
      this.ventasMaxH = Math.max(420, Math.floor(available));
      return;
    }

    const w = this.zoomOuter?.nativeElement?.clientWidth || window.innerWidth;
    const design = this.getDesignWidth();

    const z = this.clamp(w / design, this.MIN_ZOOM, this.MAX_ZOOM);
    this.uiZoom = this.round2(z);

    const top = this.zoomOuter.nativeElement.getBoundingClientRect().top;
    const bottomReserve = 140;

    const available = window.innerHeight - top - bottomReserve;
    this.ventasMaxH = Math.max(420, Math.floor(available / this.uiZoom));
  };
}
