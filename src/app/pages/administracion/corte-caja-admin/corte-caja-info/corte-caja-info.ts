// src/app/pages/corte-caja-info/corte-caja-info.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import {
  CorteCajaListado,
  CorteMovimientoViewDTO,
} from 'src/app/model/corte-caja-data';
import { CorteCajaService } from 'src/app/services/corte-caja-service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-corte-caja-info',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './corte-caja-info.html',
  styleUrl: './corte-caja-info.css',
})
export class CorteCajaInfo implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) corte!: CorteCajaListado;
  @Output() cerrar = new EventEmitter<void>();

  private srv = inject(CorteCajaService);

  detalle: any = null;        // CorteCajaResponseDTO
  salidas: any[] = [];        // SalidaEfectivo[]
  movimientos: CorteMovimientoViewDTO[] = [];

  cargando = false;
  error: string | null = null;

  // ===== Movimientos: filtros =====
  filtroMovimientos = '';
  filtroModulo: '' | 'VENTA' | 'MEMBRESIA' | 'ASESORIA' = '';
  filtroTipoPago: '' | 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' = '';

  // ===== Zoom (igual que modal de movimientos) =====
  @ViewChild('zoomOuter') zoomOuter?: ElementRef<HTMLElement>;

  uiZoom = 1;
  tablaMaxH = 520;

  private ro?: ResizeObserver;

  private readonly MIN_ZOOM = 0.75;
  private readonly MAX_ZOOM = 1.0;
  private readonly DESIGN_WIDTH = 1350;

  ngOnInit(): void {
    if (!this.corte?.idCorte) {
      this.error = 'Corte inválido.';
      return;
    }

    this.cargar();
    window.addEventListener('keydown', this.handleEsc);
  }

  ngAfterViewInit(): void {
    this.applyLayout();

    if (this.zoomOuter?.nativeElement) {
      this.ro = new ResizeObserver(() => this.applyLayout());
      this.ro.observe(this.zoomOuter.nativeElement);
    }

    window.addEventListener('resize', this.applyLayout);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleEsc);
    window.removeEventListener('resize', this.applyLayout);
    this.ro?.disconnect();
  }

  private handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cerrar.emit();
  };

  cerrarModal(): void {
    this.cerrar.emit();
  }

  refrescar(): void {
    this.cargar();
  }

  private cargar(): void {
    const id = this.corte.idCorte;

    this.cargando = true;
    this.error = null;

    // ✅ Un solo request: corte + movimientos + salidas
    this.srv
      .desglose(id)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.detalle = resp?.corte ?? null;
          this.salidas = resp?.salidas ?? [];
          this.movimientos = resp?.movimientos ?? [];

          // por si el layout se calcula antes de que pinte la tabla
          setTimeout(() => this.applyLayout(), 0);
        },
        error: (err) => {
          console.error('[CorteCajaInfo] error cargando desglose', err);
          this.error = 'No se pudo cargar la información del corte.';
        },
      });
  }

  totalSalidasLocal(): number {
    return (this.salidas ?? []).reduce(
      (acc, s) => acc + (Number(s?.monto ?? 0) || 0),
      0
    );
  }

  esCerrado(): boolean {
    return this.detalle?.estado === 'CERRADO';
  }

  limpiarFiltrosMov(): void {
    this.filtroMovimientos = '';
    this.filtroModulo = '';
    this.filtroTipoPago = '';
  }

  moduloLabel(mod: unknown): 'VENTA' | 'MEMBRESIA' | 'ASESORIA' | string {
    const m = String(mod ?? '').toUpperCase().trim();
    if (m === 'ACCESORIA') return 'ASESORIA';
    return m;
  }

  get movimientosFiltrados(): CorteMovimientoViewDTO[] {
    const q = (this.filtroMovimientos || '').trim().toLowerCase();
    const modSel = (this.filtroModulo || '').trim().toUpperCase();
    const tpSel = (this.filtroTipoPago || '').trim().toUpperCase();

    return (this.movimientos || []).filter((m) => {
      const modulo = this.moduloLabel(m?.origen);

      if (modSel && String(modulo) !== modSel) return false;
      if (tpSel && String(m?.tipoPago ?? '').toUpperCase() !== tpSel) return false;

      if (!q) return true;

      const hay = (v: unknown) => String(v ?? '').toLowerCase().includes(q);

      return (
        hay(modulo) ||
        hay(m?.folio) ||
        hay(m?.tipoPago) ||
        hay(m?.socio) ||
        hay(m?.concepto) ||
        hay(m?.cajero)
      );
    });
  }

  get totalMovimientosFiltrados(): number {
    return this.movimientosFiltrados.reduce(
      (acc, m) => acc + Number(m?.monto ?? 0),
      0
    );
  }

  // ===== zoom helpers =====
  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private applyLayout = (): void => {
    if (!this.zoomOuter?.nativeElement) return;

    const w = this.zoomOuter.nativeElement.clientWidth || 0;
    if (!w) return;

    const z = this.clamp(w / this.DESIGN_WIDTH, this.MIN_ZOOM, this.MAX_ZOOM);
    this.uiZoom = this.round2(z);

    // Ajuste para que el bloque de movimientos tenga scroll interno y se vea bien en MD/LG/XL
    const offset = 520; // header + cards + cajas + paddings aprox
    const available = window.innerHeight - offset;

    this.tablaMaxH = Math.max(260, Math.floor(available / this.uiZoom));
  };
}
