import { Component, OnInit, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SocioService } from '../../services/socio-service';
import { PaqueteService } from '../../services/paquete-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';

import { SocioData } from '../../model/socio-data';
import { PaqueteData } from '../../model/paquete-data';
import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { TiempoPlan } from '../../util/enums/tiempo-plan';

import { ResumenCompra } from '../resumen-compra/resumen-compra';
import { TipoPago } from '../../util/enums/tipo-pago';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { calcularFechaFin, calcularTotal } from '../../util/fechas-precios';



@Component({
  selector: 'app-reinscripcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ResumenCompra, TiempoPlanLabelPipe],
  templateUrl: './reinscripcion.html',
  styleUrl: './reinscripcion.css'
})
export class Reinscripcion implements OnInit {
  // inyección
  private fb           = inject(FormBuilder);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private destroyRef   = inject(DestroyRef);

  private socioSrv     = inject(SocioService);
  private paqueteSrv   = inject(PaqueteService);
  private membresiaSrv = inject(MembresiaService);
  private notify       = inject(NotificacionService);

  // estado
  idSocio!: number;
  socio = signal<SocioData | null>(null);

  paquetes: PaqueteData[] = [];
  cargandoSocio = true;
  cargandoPaquetes = true;
  guardando = false;

  mostrarResumen = signal(false);

  // formulario
  form = this.fb.group({
    paqueteId:   this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento:   this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>(this.hoyISO()),
    movimiento:  this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION')
  });

  // signals derivados desde el form (no-null)
  private paqueteIdSig   = toSignal(this.form.controls.paqueteId.valueChanges,   { initialValue: this.form.controls.paqueteId.value });
  private descuentoSig   = toSignal(this.form.controls.descuento.valueChanges,  { initialValue: this.form.controls.descuento.value });
  private fechaInicioSig = toSignal(this.form.controls.fechaInicio.valueChanges,{ initialValue: this.form.controls.fechaInicio.value });

  // derivados de UI
  paqueteSeleccionado = computed(() => {
    const id = this.paqueteIdSig();                           // no-null
    return this.paquetes.find(p => p.idPaquete === id) ?? null;
  });

  precioPaquete = computed(() => this.paqueteSeleccionado()?.precio ?? 0);
  descuento     = computed(() => this.descuentoSig());        // no-null
  total         = computed(() => calcularTotal(this.precioPaquete(), this.descuento()));

  fechaInicio   = computed(() => this.fechaInicioSig());      // no-null
  fechaPago     = computed(() => {
    const tiempo = this.paqueteSeleccionado()?.tiempo ?? null;
    return calcularFechaFin(this.fechaInicio(), tiempo as TiempoPlan | null);
  });

  ngOnInit(): void {
    // id de la ruta
    this.idSocio = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.idSocio) {
      this.notify.error('Falta el id del socio.');
      this.router.navigate(['/pages/socio']);
      return;
    }

    // cargar socio
    this.socioSrv.buscarPorId(this.idSocio).subscribe({
      next: s => { this.socio.set(s ?? null); this.cargandoSocio = false; },
      error: () => { this.cargandoSocio = false; this.notify.error('No se pudo cargar el socio.'); }
    });

    // cargar paquetes
    this.paqueteSrv.buscarTodos().subscribe({
      next: lista => { this.paquetes = lista ?? []; this.cargandoPaquetes = false; },
      error: () => { this.cargandoPaquetes = false; this.notify.error('No se pudieron cargar los paquetes.'); }
    });

    // si cambian paquete, asegurar fechaInicio set
    this.form.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.form.controls.fechaInicio.value) {
          this.form.controls.fechaInicio.setValue(this.hoyISO(), { emitEvent: false });
        }
      });
  }

  abrirResumen(): void {
    const id = this.paqueteIdSig();              // no-null
    if (id <= 0) {
      this.notify.aviso('Selecciona un paquete para continuar.');
      this.form.markAllAsTouched();
      return;
    }
    this.mostrarResumen.set(true);
  }
  cerrarResumen(): void { this.mostrarResumen.set(false); }

  confirmar(tipoPago: TipoPago): void {
    const idPaquete = this.paqueteIdSig();       // no-null
    if (idPaquete <= 0) {
      this.notify.aviso('Selecciona un paquete.');
      return;
    }

    const payload = {
      socio:      { idSocio: this.idSocio },
      paquete:    { idPaquete },                 // se envía solo el id
      movimiento: this.form.controls.movimiento.value!, // 'REINSCRIPCION'
      tipoPago,
      descuento:  this.descuento()
      // total y fechaInicio: solo UI (no se envían por ahora)
    };

    this.guardando = true;
    this.membresiaSrv.guardar(payload as any).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarResumen.set(false);
        this.notify.exito('Reinscripción realizada correctamente.');
        this.router.navigate(['/pages/socio', this.idSocio, 'historial']);
      },
      error: () => {
        this.guardando = false;
        this.notify.error('No se pudo completar la reinscripción.');
      }
    });
  }

  // helpers fecha
  private hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  nombreCompleto(): string {
    const s = this.socio();
    return s ? `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() : '';
  }
}
