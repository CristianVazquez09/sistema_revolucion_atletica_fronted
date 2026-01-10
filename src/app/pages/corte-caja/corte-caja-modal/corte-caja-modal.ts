import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CorteMovimientoViewDTO } from '../../../model/corte-caja-data';

@Component({
  selector: 'app-corte-caja-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './corte-caja-modal.html',
  styleUrl: './corte-caja-modal.css',
})
export class CorteCajaModal implements AfterViewInit, OnDestroy {
  // ===== Inputs/Outputs =====
  private _open = false;

  @Input()
  set open(v: boolean) {
    this._open = !!v;
    if (this._open) {
      setTimeout(() => this.applyLayout(), 0);
    }
  }
  get open(): boolean {
    return this._open;
  }

  @Input() cargando = false;
  @Input() movimientos: CorteMovimientoViewDTO[] = [];

  @Output() cerrar = new EventEmitter<void>();
  @Output() refrescar = new EventEmitter<void>();

  // ===== Filtros =====
  filtroMovimientos = '';
  filtroModulo: '' | 'VENTA' | 'MEMBRESIA' | 'ASESORIA' = '';
  filtroTipoPago: '' | 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' = '';

  // ===== Zoom =====
  @ViewChild('zoomOuter') zoomOuter?: ElementRef<HTMLElement>;

  uiZoom = 1;
  tablaMaxH = 520;

  private ro?: ResizeObserver;

  private readonly MIN_ZOOM = 0.75;
  private readonly MAX_ZOOM = 1.0;
  private readonly DESIGN_WIDTH = 1350;

  ngAfterViewInit(): void {
    this.applyLayout();

    if (this.zoomOuter?.nativeElement) {
      this.ro = new ResizeObserver(() => this.applyLayout());
      this.ro.observe(this.zoomOuter.nativeElement);
    }

    window.addEventListener('resize', this.applyLayout);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    window.removeEventListener('resize', this.applyLayout);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.cerrar.emit();
  }

  cerrarClickBackdrop(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.cerrar.emit();
  }

  limpiarFiltros(): void {
    this.filtroMovimientos = '';
    this.filtroModulo = '';
    this.filtroTipoPago = '';
  }

  // ===== Normalización de origen =====
  // Si por compatibilidad llega "ACCESORIA", lo pintamos como "ASESORIA"
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
    return this.movimientosFiltrados.reduce((acc, m) => acc + Number(m?.monto ?? 0), 0);
  }

  // ===== Helpers zoom =====
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

    const offset = 320;
    const available = window.innerHeight - offset;

    this.tablaMaxH = Math.max(260, Math.floor(available / this.uiZoom));
  };
}
