import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PagoData } from '../../model/membresia-data';

@Component({
  selector: 'app-resumen-compra',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resumen-compra.html',
  styleUrl: './resumen-compra.css'
})
export class ResumenCompra implements OnChanges {
  // ✅ cada vez que el padre incremente resetKey, limpiamos inputs
  @Input() resetKey = 0;

  // Datos del resumen
  @Input() socioNombre = '';
  @Input() fechaPago: string | Date | null = '';
  @Input() concepto = '';
  @Input() montoPaquete = 0;
  @Input() montoInscripcion = 0;
  @Input() descuento = 0;
  @Input() total = 0;
  @Input() guardando = false;

  @Output() cancelar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<PagoData[]>();

  // Entradas como texto para evitar spinners y permitir coma
  efectivoStr = '';
  tarjetaStr = '';
  transferenciaStr = '';

  ngOnChanges(changes: SimpleChanges): void {
    // ✅ Reset fuerte al abrir modal (resetKey cambia)
    if (changes['resetKey']) {
      this.vaciar();
      // Si quieres auto-llenar por defecto en efectivo:
      // if ((this.total ?? 0) > 0) this.llenarExactoEn('EFECTIVO');
      return;
    }

    // ✅ Si cambia el total (promo/descuento), limpiar para evitar desfase
    if (changes['total'] && !changes['total'].firstChange) {
      this.vaciar();
    }
  }

  // ───────────────────────── Helpers numéricos ─────────────────────────
  private toNum(v: string): number {
    if (!v) return 0;
    const clean = String(v)
      .replace(/\$/g, '')
      .replace(/\s+/g, '')
      .replace(',', '.');

    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }

  get efectivo(): number       { return this.toNum(this.efectivoStr); }
  get tarjeta(): number        { return this.toNum(this.tarjetaStr); }
  get transferencia(): number  { return this.toNum(this.transferenciaStr); }

  get sumaPagos(): number {
    return +(this.efectivo + this.tarjeta + this.transferencia).toFixed(2);
  }

  get diferencia(): number {
    return +((Number(this.total ?? 0)) - this.sumaPagos).toFixed(2);
  }

  get pagosValidos(): boolean {
    const total = +Number(this.total ?? 0).toFixed(2);

    // Total 0: permitir confirmar sin pagos, pero sin diferencia
    if (Math.abs(total) <= 0.01) {
      return Math.abs(this.diferencia) <= 0.01;
    }

    // Normal: debe cuadrar y haber algún pago
    return Math.abs(this.diferencia) <= 0.01 && this.sumaPagos > 0;
  }

  // ───────────────────────── Acciones UI ─────────────────────────
  llenarExactoEn(metodo: 'EFECTIVO'|'TARJETA'|'TRANSFERENCIA'): void {
    const t = (+Number(this.total ?? 0)).toFixed(2);

    if (metodo === 'EFECTIVO') {
      this.efectivoStr = t; this.tarjetaStr = ''; this.transferenciaStr = '';
    } else if (metodo === 'TARJETA') {
      this.efectivoStr = ''; this.tarjetaStr = t; this.transferenciaStr = '';
    } else {
      this.efectivoStr = ''; this.tarjetaStr = ''; this.transferenciaStr = t;
    }
  }

  vaciar(): void {
    this.efectivoStr = '';
    this.tarjetaStr = '';
    this.transferenciaStr = '';
  }

  confirmarPago(): void {
    const total = +Number(this.total ?? 0).toFixed(2);

    if (!this.pagosValidos) return;

    const pagos: PagoData[] = [];

    // Total 0 => sin pagos
    if (Math.abs(total) <= 0.01) {
      this.confirmar.emit(pagos);
      return;
    }

    if (this.efectivo > 0) {
      pagos.push({ tipoPago: 'EFECTIVO', monto: +this.efectivo.toFixed(2) });
    }
    if (this.tarjeta > 0) {
      pagos.push({ tipoPago: 'TARJETA', monto: +this.tarjeta.toFixed(2) });
    }
    if (this.transferencia > 0) {
      pagos.push({ tipoPago: 'TRANSFERENCIA', monto: +this.transferencia.toFixed(2) });
    }

    this.confirmar.emit(pagos);
  }
}
