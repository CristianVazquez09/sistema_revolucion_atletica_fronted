import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TipoPago } from '../../util/enums/tipo-pago';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-resumen-compra',
  imports: [CommonModule, FormsModule],
  templateUrl: './resumen-compra.html',
  styleUrl: './resumen-compra.css'
})
export class ResumenCompra {

  @Input() socioNombre = '';
  @Input() fechaPago = '';               // 'YYYY-MM-DD'
  @Input() concepto = '';
  @Input() montoPaquete = 0;
  @Input() montoInscripcion = 0;
  @Input() descuento = 0;
  @Input() total = 0;
  @Input() guardando = false;

  @Output() cancelar = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<TipoPago>();

  metodo: TipoPago = 'EFECTIVO';

  confirmarPago() {
    this.confirmar.emit(this.metodo);
  }

}
