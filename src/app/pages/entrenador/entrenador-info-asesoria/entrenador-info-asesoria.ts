import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { AsesoriaContratoData } from 'src/app/model/asesoria-contrato-data';
import { PagoData } from 'src/app/model/membresia-data';
import { EntrenadorData } from 'src/app/model/entrenador-data';

import { EntrenadorService } from 'src/app/services/entrenador-service';
import { MenuService } from 'src/app/services/menu-service';

@Component({
  selector: 'app-entrenador-info-asesoria',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './entrenador-info-asesoria.html',
  styleUrl: './entrenador-info-asesoria.css',
})
export class EntrenadorInfoAsesoria implements OnInit, AfterViewInit, OnDestroy {
  idEntrenador!: number;

  // header
  entrenadorNombre: string | null = null;
  entrenadorTelefono: string | null = null;

  // data
  private asesoriasAll: AsesoriaContratoData[] = []; // todas (sin paginar)
  asesorias: AsesoriaContratoData[] = []; // página visible

  // UI
  cargando = true;
  error: string | null = null;

  // paginación (client-side)
  pagina = 0; // 0-based
  tamanio = 10;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [5, 10, 20, 50];

  


    // ✅ menu
  private menuSrv = inject(MenuService);
  menuAbierto = this.menuSrv.menuAbierto;

  // ✅ breakpoint 2XL (2xl = 1536px). "XL para abajo" => !es2xlUp()
es2xlUp = signal(
  typeof window !== 'undefined'
    ? window.matchMedia('(min-width: 1536px)').matches
    : false
);


  // ✅ Ocultar Pagos SOLO en XL para abajo, y solo si menú está abierto
mostrarPagosCol = computed(() => {
  if (this.es2xlUp()) return true;     // 2XL+ => nunca ocultar
  return !this.menuAbierto();          // XL- => ocultar cuando menú abierto
});


  get tablaMinWidth(): string {
  return this.mostrarPagosCol() ? 'min-w-[1100px]' : 'min-w-[850px]';
}


  // ===================== ZOOM / LAYOUT =====================
  @ViewChild('zoomOuter', { static: true }) zoomOuter!: ElementRef<HTMLElement>;

  uiZoom = 1;
  asesoriasMaxH = 650;
  private ro?: ResizeObserver;

  private readonly MIN_ZOOM = 0.78;
  private readonly MAX_ZOOM = 1.0;

  // ...tu código existente...

  private applyLayout = (): void => {
    if (typeof window === 'undefined') return;

    // ✅ refrescar breakpoint
    this.es2xlUp.set(window.matchMedia('(min-width: 1536px)').matches);


    // Mobile: no encoger
    const isMdUp = window.matchMedia('(min-width: 768px)').matches;
    if (!isMdUp) {
      this.uiZoom = 1;
      const offsetMobile = 220;
      const available = window.innerHeight - offsetMobile;
      this.asesoriasMaxH = Math.max(420, Math.floor(available));
      return;
    }

    const w = this.zoomOuter.nativeElement.clientWidth;
    const design = 1500;
    const z = Math.min(this.MAX_ZOOM, Math.max(this.MIN_ZOOM, w / design));
    this.uiZoom = Math.round(z * 100) / 100;

    const offsetDesktop = 260;
    const available = window.innerHeight - offsetDesktop;
    this.asesoriasMaxH = Math.max(420, Math.floor(available / this.uiZoom));
  };

  constructor(private route: ActivatedRoute, private entrenadorSrv: EntrenadorService) {}

  ngOnInit(): void {
    this.idEntrenador = Number(this.route.snapshot.paramMap.get('idEntrenador'));
    this.cargarHeaderEntrenador();
    this.cargar();
  }

  ngAfterViewInit(): void {
    this.applyLayout();

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.applyLayout());
      this.ro.observe(this.zoomOuter.nativeElement);
    }

    window.addEventListener('resize', this.applyLayout);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    window.removeEventListener('resize', this.applyLayout);
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private isMdUp(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  }

  private getDesignWidth(): number {
    // Ajusta este número si quieres que encoga más/menos.
    // Entre más alto, más reduce el zoom en pantallas pequeñas.
    return 1500;
  }

 

  /* =================== Header (nombre/teléfono) =================== */

  private setHeaderFromEntrenador(e: any): void {
    if (!e) return;
    const nombre = `${e?.nombre ?? ''} ${e?.apellido ?? ''}`.trim();
    this.entrenadorNombre =
      nombre || (e?.idEntrenador ? `Entrenador ${e.idEntrenador}` : this.entrenadorNombre);

    this.entrenadorTelefono = e?.telefono ?? this.entrenadorTelefono ?? null;
  }

  private cargarHeaderEntrenador(): void {
    const req =
      (this.entrenadorSrv as any).obtenerPorId?.(this.idEntrenador) ??
      (this.entrenadorSrv as any).getById?.(this.idEntrenador) ??
      (this.entrenadorSrv as any).buscarPorId?.(this.idEntrenador);

    if (req?.subscribe) {
      req.subscribe({
        next: (e: EntrenadorData) => this.setHeaderFromEntrenador(e),
        error: () => {
          /* silencioso */
        },
      });
    }
  }

  /* =================== Rango X–Y de Z =================== */

  get rangoDesde(): number {
    if (this.totalElementos === 0) return 0;
    return this.pagina * this.tamanio + 1;
  }

  get rangoHasta(): number {
    const hasta = (this.pagina + 1) * this.tamanio;
    return Math.min(hasta, this.totalElementos);
  }

  /* =================== Cargar asesorías (NO paginado desde backend) =================== */

  cargar(): void {
    this.cargando = true;
    this.error = null;

    this.entrenadorSrv
      .listarAsesoriasActivas(this.idEntrenador)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (data: AsesoriaContratoData[]) => {
          this.asesoriasAll = data ?? [];

          this.totalElementos = this.asesoriasAll.length;
          this.totalPaginas = this.tamanio > 0 ? Math.ceil(this.totalElementos / this.tamanio) : 0;

          if (this.totalPaginas === 0) {
            this.pagina = 0;
          } else if (this.pagina >= this.totalPaginas) {
            this.pagina = this.totalPaginas - 1;
          }

          if (!this.entrenadorNombre) {
            const e: any = this.asesoriasAll[0]?.entrenador;
            if (e) this.setHeaderFromEntrenador(e);
          }

          this.aplicarPaginacion();
        },
        error: (err: unknown) => {
          console.error(err);
          this.error = 'No se pudieron cargar las asesorías del entrenador.';
        },
      });
  }

  private aplicarPaginacion(): void {
    const ini = this.pagina * this.tamanio;
    const fin = ini + this.tamanio;
    this.asesorias = this.asesoriasAll.slice(ini, fin);
  }

  /* =================== Paginación =================== */

  cambiarTamanioPagina(nuevo: number | string): void {
    this.tamanio = Number(nuevo);
    this.pagina = 0;

    this.totalPaginas = this.tamanio > 0 ? Math.ceil(this.totalElementos / this.tamanio) : 0;

    this.aplicarPaginacion();
  }

  irPrimera(): void {
    if (this.pagina === 0) return;
    this.pagina = 0;
    this.aplicarPaginacion();
  }
  irAnterior(): void {
    if (this.pagina === 0) return;
    this.pagina--;
    this.aplicarPaginacion();
  }
  irSiguiente(): void {
    if (this.pagina + 1 >= this.totalPaginas) return;
    this.pagina++;
    this.aplicarPaginacion();
  }
  irUltima(): void {
    if (this.totalPaginas === 0) return;
    if (this.pagina === this.totalPaginas - 1) return;
    this.pagina = this.totalPaginas - 1;
    this.aplicarPaginacion();
  }

  /* =================== Helpers UI =================== */

  esVigente(vigenteHasta?: string | null): boolean {
    if (!vigenteHasta) return false;
    const d = new Date(vigenteHasta);
    if (Number.isNaN(d.getTime())) return false;
    return d.getTime() > Date.now();
  }

  labelTiempo(t: string | null | undefined): string {
    return String(t ?? '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  pagosConMonto(pagos?: PagoData[] | null): PagoData[] {
    return (pagos ?? []).filter((p) => Number(p?.monto) > 0);
  }

  labelPago(tipo: PagoData['tipoPago'] | string): string {
    switch (tipo) {
      case 'EFECTIVO':
        return 'Efectivo';
      case 'TARJETA':
        return 'Tarjeta';
      case 'TRANSFERENCIA':
        return 'Transferencia';
      default:
        return String(tipo);
    }
  }

  nombreSocio(a: AsesoriaContratoData): string {
    const s = a.socio as any;
    if (!s) return '—';
    const full = `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim();
    return full || (s.idSocio ? `Socio ${s.idSocio}` : '—');
  }

  telefonoSocio(a: AsesoriaContratoData): string {
    const s = a.socio as any;
    return s?.telefono || '—';
  }

  emailSocio(a: AsesoriaContratoData): string {
    const s = a.socio as any;
    return s?.email || '—';
  }

  
}
