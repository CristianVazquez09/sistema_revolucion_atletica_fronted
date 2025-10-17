import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { MembresiaService } from '../../../../services/membresia-service';
import { MembresiaData, PagoData } from '../../../../model/membresia-data';

@Component({
  selector: 'app-membresia-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './membresia-modal.html',
  styleUrl: './membresia-modal.css'
})
export class MembresiaModal implements OnInit {
  
  @Input() idMembresia!: number;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  private srv = inject(MembresiaService);

  form = new FormGroup({
    fechaInicio: new FormControl('', Validators.required),
    fechaFin: new FormControl('', Validators.required),
    descuento: new FormControl<number>(0, [Validators.min(0)]),
    total: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  data: MembresiaData | null = null;
  cargando = true;
  guardando = false;
  error: string | null = null;

  ngOnInit(): void {
    this.srv.buscarPorId(this.idMembresia).subscribe({
      next: (m) => {
        this.data = m;
        this.form.patchValue({
          fechaInicio: m.fechaInicio,
          fechaFin: m.fechaFin,
          descuento: m.descuento ?? 0,
          total: m.total ?? 0,
        }, { emitEvent: false });
        this.cargando = false;
      },
      error: () => { this.error = 'No se pudo cargar la membresía.'; this.cargando = false; }
    });
  }

  guardar(): void {
    if (!this.data) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const f = this.form.getRawValue();
    const payload: MembresiaData = {
      ...this.data,
      fechaInicio: f.fechaInicio!,
      fechaFin: f.fechaFin!,
      descuento: Number(f.descuento ?? 0),
      total: Number(f.total ?? 0),
      pagos: (this.data.pagos ?? []) as PagoData[], // se envían igual
    };

    this.guardando = true;
    this.srv.actualizar(this.data.idMembresia!, payload).subscribe({
      next: () => { this.guardando = false; this.guardado.emit(); },
      error: () => { this.guardando = false; this.error = 'No se pudo guardar los cambios.'; }
    });
  }
}
