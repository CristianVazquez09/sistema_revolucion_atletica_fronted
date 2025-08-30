import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TipoPago } from '../../util/enums/tipo-pago';

type ItemResumen = {
  nombre: string;
  cantidad: number;
  precioUnit: number;
};

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
  @Input() total = 0;
  @Input() guardando = false;
  @Input() tipoPagoInicial: TipoPago = 'EFECTIVO';

  /** Salidas */
  @Output() cancelar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<TipoPago>();

  /** Estado local */
  tipoPago: TipoPago = 'EFECTIVO';
  readonly opcionesPago: TipoPago[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipoPagoInicial'] && this.tipoPagoInicial) {
      this.tipoPago = this.tipoPagoInicial;
    }
  }

  get subtotal(): number {
    return this.items.reduce((acc, it) => acc + it.precioUnit * it.cantidad, 0);
  }

  onConfirmar(): void {
    if (this.items.length === 0 || this.guardando) return;
    this.confirmar.emit(this.tipoPago);
  }
}
