import { Component, EventEmitter, Input, OnInit, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { ProductoData } from '../../../../../shared/models/producto-data';
import { NotificacionService } from '../../../../../core/layout/notificacion-service';
import { ProductoService } from '../../../data/producto-service';
import { RaModal } from '../../../../../shared/ui/ra-modal/ra-modal';

export type StockModalModo = 'ENTRADA' | 'AJUSTE';

@Component({
  selector: 'app-stock-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RaModal],
  templateUrl: './stock-modal.html',
  styleUrl: './stock-modal.css',
})
export class StockModal implements OnInit {
  @Input() producto!: ProductoData;
  @Input() modo: StockModalModo = 'ENTRADA';

  @Output() cancelar = new EventEmitter<void>();
  @Output() aplicado = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private productoSrv = inject(ProductoService);
  private noti = inject(NotificacionService);

  titulo = computed(() => (this.modo === 'ENTRADA' ? 'Entrada de stock' : 'Ajustar stock'));
  guardando = false;
  error: string | null = null;
  intento = false;

  form = this.fb.group({
    cantidad: this.fb.control<number>(1, [Validators.required, Validators.min(1)]),
    nuevoStock: this.fb.control<number>(0, [Validators.required, Validators.min(0)]),
    nota: this.fb.control<string>('', [Validators.maxLength(120)]),
  });

  ngOnInit(): void {
    // precarga valores
    const actual = Number(this.producto?.cantidad ?? 0);

    if (this.modo === 'AJUSTE') {
      this.form.controls.nuevoStock.setValue(actual, { emitEvent: false });
    } else {
      this.form.controls.cantidad.setValue(1, { emitEvent: false });
    }
  }

  submit(): void {
    this.intento = true;
    this.error = null;

    if (!this.producto?.idProducto) {
      this.error = 'Producto inválido.';
      return;
    }

    if (this.modo === 'ENTRADA') {
      if (this.form.controls.cantidad.invalid) {
        this.form.controls.cantidad.markAsTouched();
        return;
      }
    } else {
      if (this.form.controls.nuevoStock.invalid) {
        this.form.controls.nuevoStock.markAsTouched();
        return;
      }
    }

    this.guardando = true;

    const nota = (this.form.controls.nota.value ?? '').trim() || null;

    if (this.modo === 'ENTRADA') {
      const cantidad = Number(this.form.controls.cantidad.value ?? 0);

      this.productoSrv.registrarEntrada(this.producto.idProducto, { cantidad, nota }).subscribe({
        next: () => {
          this.noti.exito('Entrada registrada.');
          this.guardando = false;
          this.aplicado.emit();
        },
        error: (err) => {
          console.error(err);
          this.error = 'No se pudo registrar la entrada.';
          this.guardando = false;
        },
      });
    } else {
      const nuevoStock = Number(this.form.controls.nuevoStock.value ?? 0);

      this.productoSrv.ajustarStock(this.producto.idProducto, { nuevoStock, nota }).subscribe({
        next: () => {
          this.noti.exito('Ajuste registrado.');
          this.guardando = false;
          this.aplicado.emit();
        },
        error: (err) => {
          console.error(err);
          this.error = 'No se pudo registrar el ajuste.';
          this.guardando = false;
        },
      });
    }
  }
}
