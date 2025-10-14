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
  // Datos del resumen (equivalentes a ResumenCompra)
  @Input() fecha: string | Date | null = new Date();
  @Input() items: ItemResumen[] = [];
  @Input() total = 0;
  @Input() guardando = false;

  @Output() cancelar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<PagoData[]>();

  // Entradas como texto para evitar spinners y permitir coma
  efectivoStr = '';
  tarjetaStr = '';
  transferenciaStr = '';

  // ───────────────────────── Helpers numéricos (idénticos a compra) ─────────────────────────
  private toNum(v: string): number {
    if (!v) return 0;
    // Acepta coma decimal
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  get efectivo(): number       { return this.toNum(this.efectivoStr); }
  get tarjeta(): number        { return this.toNum(this.tarjetaStr); }
  get transferencia(): number  { return this.toNum(this.transferenciaStr); }

  get sumaPagos(): number {
    return +(this.efectivo + this.tarjeta + this.transferencia).toFixed(2);
  }
  get diferencia(): number {
    return +((this.total ?? 0) - this.sumaPagos).toFixed(2);
  }
  get pagosValidos(): boolean {
    // tolerancia centavos
    return Math.abs(this.diferencia) <= 0.01 && this.sumaPagos > 0;
  }

  // ───────────────────────── Acciones UI (idénticas a compra) ─────────────────────────
  llenarExactoEn(metodo: 'EFECTIVO'|'TARJETA'|'TRANSFERENCIA'): void {
    const t = (this.total ?? 0).toFixed(2);
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
    if (this.efectivo > 0)      pagos.push({ tipoPago: 'EFECTIVO',      monto: this.efectivo });
    if (this.tarjeta  > 0)      pagos.push({ tipoPago: 'TARJETA',       monto: this.tarjeta });
    if (this.transferencia > 0) pagos.push({ tipoPago: 'TRANSFERENCIA', monto: this.transferencia });

    this.confirmar.emit(pagos);
  }
}
