import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PagoData } from '../../model/membresia-data';

type ItemResumen = { nombre: string; cantidad: number; precioUnit: number; };

@Component({
  selector: 'app-resumen-venta',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resumen-venta.html',
  styleUrl: './resumen-venta.css'
})
export class ResumenVenta {
  @Input() fecha: string | Date | null = new Date();
  @Input() items: ItemResumen[] = [];
  /** Total FINAL a cobrar (padre ya restó el descuento) */
  @Input() total = 0;
  /** Descuento para mostrar en el resumen (solo lectura) */
  @Input() descuento = 0;
  @Input() guardando = false;

  @Output() cancelar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<PagoData[]>();

  // Entradas de pago como texto
  efectivoStr = '';
  tarjetaStr = '';
  transferenciaStr = '';

  // ─── Helpers numéricos ───
  private toNum(v: string): number {
    if (!v) return 0;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  get efectivo(): number      { return this.toNum(this.efectivoStr); }
  get tarjeta(): number       { return this.toNum(this.tarjetaStr); }
  get transferencia(): number { return this.toNum(this.transferenciaStr); }

  get sumaPagos(): number {
    return +(this.efectivo + this.tarjeta + this.transferencia).toFixed(2);
  }

  get diferencia(): number {
    return +(this.total - this.sumaPagos).toFixed(2);
  }

  get pagosValidos(): boolean {
    const t = +Number(this.total ?? 0).toFixed(2);
    // Total 0 (descuento al 100%): válido sin pagos
    if (Math.abs(t) <= 0.01) return Math.abs(this.diferencia) <= 0.01;
    return Math.abs(this.diferencia) <= 0.01 && this.sumaPagos > 0;
  }

  // ─── Acciones UI ───
  llenarExactoEn(metodo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'): void {
    const t = (+this.total).toFixed(2);
    if (metodo === 'EFECTIVO') {
      this.efectivoStr = t; this.tarjetaStr = ''; this.transferenciaStr = '';
    } else if (metodo === 'TARJETA') {
      this.efectivoStr = ''; this.tarjetaStr = t; this.transferenciaStr = '';
    } else {
      this.efectivoStr = ''; this.tarjetaStr = ''; this.transferenciaStr = t;
    }
  }

  vaciar(): void {
    this.efectivoStr = this.tarjetaStr = this.transferenciaStr = '';
  }

  confirmarPago(): void {
    if (!this.pagosValidos) return;

    const pagos: PagoData[] = [];

    // Total 0 (descuento 100%): sin pagos
    if (Math.abs(+Number(this.total ?? 0).toFixed(2)) <= 0.01) {
      this.confirmar.emit(pagos);
      return;
    }

    if (this.efectivo > 0)      pagos.push({ tipoPago: 'EFECTIVO',      monto: +this.efectivo.toFixed(2) });
    if (this.tarjeta > 0)       pagos.push({ tipoPago: 'TARJETA',       monto: +this.tarjeta.toFixed(2) });
    if (this.transferencia > 0) pagos.push({ tipoPago: 'TRANSFERENCIA', monto: +this.transferencia.toFixed(2) });

    this.confirmar.emit(pagos);
  }
}
