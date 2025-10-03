import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TipoPago } from '../../util/enums/tipo-pago';
import { PagoData } from '../../model/membresia-data';

type ItemResumen = { nombre: string; cantidad: number; precioUnit: number; };

@Component({
  selector: 'app-resumen-venta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resumen-venta.html',
  styleUrl: './resumen-venta.css'
})
export class ResumenVenta implements OnChanges {

  /** Entradas */
  @Input() fecha: Date | string = new Date();
  @Input() items: ItemResumen[] = [];
  @Input() total = 0;                 // total esperado (carrito)
  @Input() guardando = false;

  /** Salidas */
  @Output() cancelar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<PagoData[]>();  // 👈 enviamos pagos[]

  // Estado local para los 3 métodos
  efectivoStr = '';
  tarjetaStr = '';
  transferenciaStr = '';

  // Compatibilidad por si el padre cambia los items/total
  ngOnChanges(_c: SimpleChanges): void {
    // no-op; mantén si más tarde quieres recalcular/limpiar
  }

  /** Parse seguro (coma o punto) */
  private parseMonto(s: string): number {
    if (!s) return 0;
    const n = Number(String(s).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  get sumaPagos(): number {
    return this.parseMonto(this.efectivoStr) + this.parseMonto(this.tarjetaStr) + this.parseMonto(this.transferenciaStr);
  }
  get diferencia(): number {
    return this.total - this.sumaPagos;
  }
  get pagosValidos(): boolean {
    return Math.abs(this.diferencia) < 0.01; // tolerancia
  }

  llenarExactoEn(tipo: TipoPago) {
    const faltante = this.total - this.sumaPagos;
    const val = (v: number) => (v <= 0 ? '' : String(v.toFixed(2)));
    if (tipo === 'EFECTIVO')       this.efectivoStr = val(this.parseMonto(this.efectivoStr) + Math.max(0, faltante));
    if (tipo === 'TARJETA')        this.tarjetaStr  = val(this.parseMonto(this.tarjetaStr)  + Math.max(0, faltante));
    if (tipo === 'TRANSFERENCIA')  this.transferenciaStr = val(this.parseMonto(this.transferenciaStr) + Math.max(0, faltante));
  }
  vaciar() {
    this.efectivoStr = this.tarjetaStr = this.transferenciaStr = '';
  }

  /** Construye el array de pagos filtrando ceros */
  private buildPagos(): PagoData[] {
    const pagos: PagoData[] = [
      { tipoPago: 'EFECTIVO',      monto: this.parseMonto(this.efectivoStr) },
      { tipoPago: 'TARJETA',       monto: this.parseMonto(this.tarjetaStr) },
      { tipoPago: 'TRANSFERENCIA', monto: this.parseMonto(this.transferenciaStr) },
    ];
    return pagos.filter(p => (p.monto ?? 0) > 0.0001);
  }

  onConfirmar(): void {
    if (this.guardando || !this.pagosValidos || this.items.length === 0) return;
    this.confirmar.emit(this.buildPagos());        // 👈 regresamos pagos[]
  }
}
