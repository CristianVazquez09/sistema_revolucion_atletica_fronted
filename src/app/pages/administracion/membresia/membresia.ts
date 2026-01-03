import {
  Component, DestroyRef, ElementRef, inject, NgZone,
  signal, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MembresiaData } from '../../../model/membresia-data';
import { NotificacionService } from '../../../services/notificacion-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { MembresiaModal } from './membresia-modal/membresia-modal';
import { MembresiaPageResponse, MembresiaService } from '../../../services/membresia-service';
import { TiempoPlanLabelPipe } from 'src/app/util/tiempo-plan-label';
import { TicketMembresia, TicketPagoDetalle, TicketService } from 'src/app/services/ticket-service';

type PageMeta = { size: number; number: number; totalElements: number; totalPages: number; };

@Component({
  selector: 'app-membresia',
  standalone: true,
  imports: [CommonModule, FormsModule, MembresiaModal, TiempoPlanLabelPipe],
  templateUrl: './membresia.html',
  styleUrl: './membresia.css'
})
export class Membresia {
  private srv = inject(MembresiaService);
  private noti = inject(NotificacionService);
  private jwt = inject(JwtHelperService);
  private ticket = inject(TicketService);
  private destroyRef = inject(DestroyRef);
  private zone = inject(NgZone);

  // UI signals
  mostrarPagos = signal(true);
  moverOrdenYSize = signal(false);
  ocultarFechas = signal(false);
  ocultarDescuento = signal(false);

  // ✅ Consideramos “pantalla grande” desde XL (>=1280px)
  esXlUp = signal(typeof window !== 'undefined'
    ? window.matchMedia('(min-width: 1280px)').matches
    : false
  );

  private baseWidth = 0;

  @ViewChild('tablaWrap') tablaWrap?: ElementRef<HTMLElement>;

  // estado
  rows: MembresiaData[] = [];
  page: PageMeta = { size: 10, number: 0, totalElements: 0, totalPages: 0 };
  cargando = false;
  error: string | null = null;

  // filtros/orden
  sizeSel = 10;
  sortCampo: 'fechaInicio' | 'fechaFin' | 'idMembresia' | 'folio' | 'total' = 'fechaInicio';
  sortDir: 'asc' | 'desc' = 'desc';

  // búsqueda por folio
  folioBuscar: number | null = null;
  buscandoFolio = false;

  // búsqueda por nombre de socio
  nombreBuscar: string = '';
  modoBusquedaNombre = false;
  ultimoTerminoNombre = '';

  // filtro por rango de fechas
  fechaDesde: string = ''; // 'YYYY-MM-DD'
  fechaHasta: string = '';
  filtroFechasActivo = false;

  // roles
  esAdmin = false;
  esRecep = false;

  // acciones
  reimprimiendo = false;

  // modal
  mostrarModal = signal(false);
  idEditando: number | null = null;

  ngAfterViewInit(): void {
    const el = this.tablaWrap?.nativeElement;
    if (!el || typeof window === 'undefined') return;

    const mq = window.matchMedia('(min-width: 1280px)');

    const UMBRAL_OCULTAR_PAGOS = 1180;
    const DELTA_MENU_ABIERTO = 80;
    const RATIO_MENU_ABIERTO = 0.80;

    const recalcular = (w: number) => {
      if (this.baseWidth === 0 || w > this.baseWidth) this.baseWidth = w;

      const viewportW = Math.max(1, window.innerWidth || 1);
      const ratio = w / viewportW;

      const menuComprime =
        (this.baseWidth - w) > DELTA_MENU_ABIERTO ||
        ratio < RATIO_MENU_ABIERTO;

      // Pagos por ancho real
      this.mostrarPagos.set(w >= UMBRAL_OCULTAR_PAGOS);

      // ✅ Orden:
      // - <xl: SIEMPRE abajo (independiente del menú)
      // - >=xl: abajo SOLO si el menú comprime
      if (!this.esXlUp()) this.moverOrdenYSize.set(true);
      else this.moverOrdenYSize.set(menuComprime);

      // Fechas y descuento: solo ocultar en <xl cuando el menú comprime
      this.ocultarFechas.set(!this.esXlUp() && menuComprime);
      this.ocultarDescuento.set(!this.esXlUp() && menuComprime);
    };

    const syncXl = () => {
      this.esXlUp.set(mq.matches);
      this.baseWidth = 0;
      recalcular(el.getBoundingClientRect().width);
    };

    // inicial
    this.zone.run(syncXl);

    // cambios breakpoint
    const onMqChange = () => this.zone.run(syncXl);
    if ('addEventListener' in mq) mq.addEventListener('change', onMqChange);
    else (mq as any).addListener(onMqChange);

    this.destroyRef.onDestroy(() => {
      if ('removeEventListener' in mq) mq.removeEventListener('change', onMqChange);
      else (mq as any).removeListener(onMqChange);
    });

    // cambios de tamaño del contenedor (abrir/cerrar menú)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      this.zone.run(() => recalcular(w));
    });
    ro.observe(el);

    // resize ventana
    const onWinResize = () => {
      this.zone.run(() => {
        this.baseWidth = 0;
        recalcular(el.getBoundingClientRect().width);
      });
    };
    window.addEventListener('resize', onWinResize);

    this.destroyRef.onDestroy(() => {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
    });
  }

  ngOnInit(): void {
    const roles = this.rolesDesdeToken();
    this.esAdmin = roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    this.esRecep = roles.includes('RECEPCIONISTA') || roles.includes('ROLE_RECEPCIONISTA');
    this.cargar(1);
  }

  private rolesDesdeToken(): string[] {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return [];
    try {
      const d: any = this.jwt.decodeToken(raw);
      return [
        ...(Array.isArray(d?.roles) ? d.roles : []),
        ...(Array.isArray(d?.authorities) ? d.authorities : []),
        ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
        d?.role, d?.rol, d?.perfil
      ]
        .filter(Boolean)
        .map((r: string) => String(r).toUpperCase());
    } catch {
      return [];
    }
  }

  get sortSel(): string { return `${this.sortCampo},${this.sortDir}`; }

  // ========================= Carga general =========================

  cargar(pageUI: number): void {
    this.error = null;
    this.cargando = true;

    const opts = { page: pageUI, size: this.sizeSel, sort: this.sortSel };

    let obs;

    if (this.modoBusquedaNombre && this.ultimoTerminoNombre.trim().length >= 3) {
      obs = this.srv.buscarPorNombreSocio(this.ultimoTerminoNombre, opts);
    } else if (this.filtroFechasActivo && this.fechaDesde && this.fechaHasta) {
      obs = this.srv.listarPorRango(this.fechaDesde, this.fechaHasta, opts);
    } else {
      obs = this.srv.listar(opts);
    }

    obs.subscribe({
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

  /* ========================== Búsqueda por folio ========================== */

  buscarPorFolio(): void {
    const folio = Number(this.folioBuscar || 0);
    if (!folio) {
      this.limpiarBusqueda();
      return;
    }

    this.error = null;
    this.buscandoFolio = true;
    this.cargando = true;

    this.srv.buscarPorFolio(folio).subscribe({
      next: (m: MembresiaData) => {
        this.rows = [m];
        this.page = { size: 1, number: 0, totalElements: 1, totalPages: 1 };

        this.modoBusquedaNombre = false;
        this.ultimoTerminoNombre = '';
        this.nombreBuscar = '';
        this.filtroFechasActivo = false;
        this.fechaDesde = '';
        this.fechaHasta = '';

        this.cargando = false;
        this.buscandoFolio = false;
      },
      error: () => {
        this.rows = [];
        this.page = { size: 1, number: 0, totalElements: 0, totalPages: 0 };
        this.error = `No existe la membresía con folio #${folio}.`;
        this.noti.error(this.error);
        this.cargando = false;
        this.buscandoFolio = false;
      }
    });
  }

  /* ====================== Búsqueda por nombre socio ====================== */

  onNombreInputChange(value: string): void {
    this.nombreBuscar = value;
    const term = (value || '').trim();

    if (term.length >= 3) {
      this.modoBusquedaNombre = true;
      this.ultimoTerminoNombre = term;

      this.filtroFechasActivo = false;
      this.fechaDesde = '';
      this.fechaHasta = '';

      this.cargar(1);
    } else {
      if (this.modoBusquedaNombre) {
        this.modoBusquedaNombre = false;
        this.ultimoTerminoNombre = '';
        this.cargar(1);
      }
    }
  }

  /* ====================== Filtro por rango de fechas ====================== */

  aplicarRangoFechas(): void {
    const d = (this.fechaDesde || '').trim();
    const h = (this.fechaHasta || '').trim();

    if (!d || !h) {
      this.noti.error('Selecciona la fecha inicial y final.');
      return;
    }
    if (d > h) {
      this.noti.error('La fecha inicial no puede ser mayor que la final.');
      return;
    }

    this.filtroFechasActivo = true;
    this.modoBusquedaNombre = false;
    this.ultimoTerminoNombre = '';
    this.nombreBuscar = '';

    this.buscandoFolio = false;
    this.folioBuscar = null;

    this.cargar(1);
  }

  limpiarRangoFechas(): void {
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.filtroFechasActivo = false;
    this.cargar(1);
  }

  /* ====================== Limpiar búsquedas ====================== */

  limpiarBusqueda(): void {
    this.folioBuscar = null;
    this.nombreBuscar = '';
    this.modoBusquedaNombre = false;
    this.ultimoTerminoNombre = '';

    this.fechaDesde = '';
    this.fechaHasta = '';
    this.filtroFechasActivo = false;

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

  editar(m: MembresiaData): void {
    this.idEditando = m.idMembresia ?? null;
    this.mostrarModal.set(true);
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.idEditando = null;
  }

  onGuardado(): void {
    this.cerrarModal();
    this.cargar(this.pageUI);
  }

  eliminar(m: MembresiaData): void {
    if (this.esRecep) return;
    if (!m?.idMembresia) return;
    if (!confirm(`¿Eliminar la membresía #${m.idMembresia}?`)) return;

    this.srv.eliminar(m.idMembresia).subscribe({
      next: () => this.cargar(this.pageUI),
      error: () => this.noti.error('No se pudo eliminar la membresía.')
    });
  }

  reimprimir(m: MembresiaData): void {
    if (!m?.idMembresia || this.reimprimiendo) return;

    this.reimprimiendo = true;

    const gym: any = (m.paquete as any)?.gimnasio || (m.socio as any)?.gimnasio || {};
    const negocio: TicketMembresia['negocio'] = {
      nombre: gym?.nombre || 'Gimnasio',
      direccion: gym?.direccion,
      telefono: gym?.telefono,
    };

    const cajero = m.usuario?.nombreUsuario || '';
    const socioNombre = `${m.socio?.nombre ?? ''} ${m.socio?.apellido ?? ''}`.trim();

    const desc = Number(m.descuento || 0);
    const total = Number(m.total || 0);
    const importe = total + desc;

    const pagos: TicketPagoDetalle[] | undefined =
      (m.pagos && m.pagos.length)
        ? m.pagos.map(p => ({
          metodo: p.tipoPago,
          monto: Number(p.monto) || 0,
        }))
        : undefined;

    const data: TicketMembresia = {
      negocio,
      folio: m.folio ?? m.idMembresia ?? '',
      fecha: m.fechaInicio ?? new Date(),
      cajero,
      socio: socioNombre,
      concepto: `Membresía ${m.paquete?.nombre ?? ''}`.trim(),
      importe,
      descuento: desc,
      total,
      totalAPagar: total,
      pagos,
      estado: 'PAGADO',
    };

    try {
      this.ticket.imprimirMembresia(data);
      this.noti.info(`Ticket de membresía #${m.folio ?? m.idMembresia} enviado a impresión.`);
    } catch (e) {
      console.error(e);
      this.noti.error('No se pudo reimprimir el ticket de la membresía.');
    } finally {
      this.reimprimiendo = false;
    }
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
    const t = tot('TARJETA'); if (t > 0) chips.push(`Tarjeta ${fmt(t)}`);
    const tr = tot('TRANSFERENCIA'); if (tr > 0) chips.push(`Transf. ${fmt(tr)}`);
    return chips.join(' · ') || '—';
  }

  gymNombre(g: any): string {
    return g?.nombre ?? (g?.idGimnasio ?? g?.id ? `#${g?.idGimnasio ?? g?.id}` : '—');
  }

  trackById = (_: number, it: MembresiaData) => it.idMembresia!;

  get colSpanTabla(): number {
    // Folio, Socio, Paquete, F. inicio, F. fin, Movimiento, Total, Usuario, Acciones = 9
    let cols = 9;
    if (this.mostrarPagos()) cols += 1;
    if (!this.ocultarDescuento()) cols += 1;
    if (this.esAdmin) cols += 1;
    return cols;
  }
}
