import { Component, OnInit, signal, inject, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ResumenCompra } from '../resumen-compra/resumen-compra';

import { PaqueteService } from '../../services/paquete-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';

import { PaqueteData } from '../../model/paquete-data';
import { SocioData } from '../../model/socio-data';
import { MembresiaData } from '../../model/membresia-data';

import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { calcularFechaFin, calcularTotal, hoyISO } from '../../util/fechas-precios';
import { TipoPago } from '../../util/enums/tipo-pago';


type SocioRequest = Omit<SocioData, 'idSocio'> & { idSocio?: number };

@Component({
  selector: 'app-inscripcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ResumenCompra, TiempoPlanLabelPipe],
  templateUrl: './inscripcion.html',
  styleUrl: './inscripcion.css'
})
export class Inscripcion implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private notificacion = inject(NotificacionService);

  listaPaquetes: PaqueteData[] = [];
  cargandoPaquetes = true;

  mostrarModalResumen = signal(false);
  mensajeError: string | null = null;
  guardandoMembresia = false;

  paqueteSeleccionado = signal<PaqueteData | null>(null);

  // 🖼️ Foto (solo local)
  fotoArchivo: File | null = null;
  fotoPreviewUrl: string | null = null;

  formularioInscripcion = this.fb.group({
    nombre:           this.fb.nonNullable.control('', [Validators.required]),
    apellido:         this.fb.nonNullable.control('', [Validators.required]),
    telefono:         this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^\d{10}$/)]),
    email:            this.fb.control<string | null>(null, [Validators.email]),
    fechaNacimiento:  this.fb.control<string | null>(null),
    direccion:        this.fb.nonNullable.control('', [Validators.required]),
    genero:           this.fb.nonNullable.control<'MASCULINO'|'FEMENINO'>('MASCULINO', [Validators.required]),
    comentarios:      this.fb.control<string | null>(null),

    paqueteId:        this.fb.nonNullable.control(0, [Validators.min(1)]),
    fechaInicio:      this.fb.nonNullable.control(hoyISO()),
    descuento:        this.fb.nonNullable.control(0, [Validators.min(0)]),
    movimiento:       this.fb.nonNullable.control<TipoMovimiento>('INSCRIPCION'),
  });

  private paqueteIdSig = toSignal(this.formularioInscripcion.controls.paqueteId.valueChanges, { initialValue: this.formularioInscripcion.controls.paqueteId.value });
  private descuentoSig = toSignal(this.formularioInscripcion.controls.descuento.valueChanges, { initialValue: this.formularioInscripcion.controls.descuento.value });
  private fechaInicioSig = toSignal(this.formularioInscripcion.controls.fechaInicio.valueChanges, { initialValue: this.formularioInscripcion.controls.fechaInicio.value });

  paqueteActual = computed(() => {
    const id = Number(this.paqueteIdSig() ?? 0);
    return this.listaPaquetes.find(p => p.idPaquete === id) ?? null;
  });

  precioPaquete    = computed(() => this.paqueteActual()?.precio ?? 0);
  costoInscripcion = computed(() => this.paqueteActual()?.costoInscripcion ?? 0);
  descuentoValor   = computed(() => Number(this.descuentoSig() ?? 0));

  totalVista = computed(() => calcularTotal(this.precioPaquete(), this.descuentoValor(), this.costoInscripcion()));
  totalSinDescuento = computed(() => calcularTotal(this.precioPaquete(), 0, this.costoInscripcion()));

  fechaPagoVista = computed(() => {
    const inicio = this.fechaInicioSig() ?? hoyISO();
    const tiempo = this.paqueteActual()?.tiempo ?? null;
    return calcularFechaFin(inicio, tiempo);
  });

  constructor(
    private paqueteSrv: PaqueteService,
    private membresiaSrv: MembresiaService
  ) {}

  ngOnInit(): void {
    this.cargarPaquetes();

    this.formularioInscripcion.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.sincronizarPaqueteSeleccionado(id ?? 0));
  }

  // 📦 Paquetes
  private cargarPaquetes(): void {
    this.cargandoPaquetes = true;
    this.paqueteSrv.buscarTodos().subscribe({
      next: lista => {
        this.listaPaquetes = lista ?? [];
        this.cargandoPaquetes = false;
        this.sincronizarPaqueteSeleccionado(this.formularioInscripcion.controls.paqueteId.value ?? 0);
      },
      error: () => {
        this.cargandoPaquetes = false;
        this.mensajeError = 'No se pudieron cargar los paquetes.';
      }
    });
  }

  private sincronizarPaqueteSeleccionado(idPaquete: number): void {
    if (!idPaquete || idPaquete <= 0) { this.paqueteSeleccionado.set(null); return; }
    const encontrado = this.listaPaquetes.find(p => p.idPaquete === idPaquete) ?? null;
    this.paqueteSeleccionado.set(encontrado);
  }

  // 🧾 Modal
  abrirModalResumen(): void {
    const faltantes = this.camposFaltantes();
    if (faltantes.length) {
      this.formularioInscripcion.markAllAsTouched();
      this.mensajeError = 'Completa o corrige: ' + faltantes.join(', ') + '.';
      return;
    }
    this.mensajeError = null;
    this.mostrarModalResumen.set(true);
  }
  cerrarModalResumen(): void { this.mostrarModalResumen.set(false); }

  private camposFaltantes(): string[] {
    const c = this.formularioInscripcion.controls;
    const f: string[] = [];
    if (c.nombre.invalid)     f.push('Nombre');
    if (c.apellido.invalid)   f.push('Apellidos');
    if (c.telefono.invalid)   f.push('Teléfono (10 dígitos)');
    if (c.direccion.invalid)  f.push('Dirección');
    if (!c.paqueteId.value || c.paqueteId.value <= 0) f.push('Paquete');
    if (c.genero.invalid)     f.push('Sexo');
    return f;
  }

  // 💾 Guardar
  confirmarPagoYGuardar(tipoPago: TipoPago): void {
    let paquete = this.paqueteSeleccionado();
    const paqueteId = this.formularioInscripcion.controls.paqueteId.value ?? 0;

    if (!paquete && paqueteId > 0) {
      paquete = this.listaPaquetes.find(p => p.idPaquete === paqueteId) ?? null;
      this.paqueteSeleccionado.set(paquete);
    }
    if (!paquete) {
      this.notificacion.aviso('Selecciona un paquete antes de confirmar.');
      return;
    }

    const fechaInicio = this.formularioInscripcion.controls.fechaInicio.value!;
    const fechaFin = calcularFechaFin(fechaInicio, paquete.tiempo);

    const socioNuevo: SocioRequest = {
      nombre:          this.formularioInscripcion.controls.nombre.value!,
      apellido:        this.formularioInscripcion.controls.apellido.value!,
      direccion:       this.formularioInscripcion.controls.direccion.value!,
      telefono:        this.formularioInscripcion.controls.telefono.value!,
      email:           this.formularioInscripcion.controls.email.value ?? '',
      fechaNacimiento: this.formularioInscripcion.controls.fechaNacimiento.value ?? '',
      genero:          this.formularioInscripcion.controls.genero.value!,
      comentarios:     this.formularioInscripcion.controls.comentarios.value ?? ''
    };

    const cuerpo: MembresiaData = {
      socio:   socioNuevo as unknown as SocioData,
      paquete: paquete, // si tu backend prefiere solo id => { idPaquete: paquete.idPaquete } as any
      fechaInicio,
      fechaFin,
      movimiento: this.formularioInscripcion.controls.movimiento.value!,
      tipoPago,
      descuento: this.formularioInscripcion.controls.descuento.value!,
      total: this.totalSinDescuento()
    };

    this.guardandoMembresia = true;
    this.membresiaSrv.guardar(cuerpo).subscribe({
      next: () => {
        this.guardandoMembresia = false;
        this.cerrarModalResumen();

        const hoy = hoyISO();
        this.formularioInscripcion.reset({
          genero: 'MASCULINO',
          movimiento: 'INSCRIPCION',
          fechaInicio: hoy,
          descuento: 0,
          paqueteId: 0
        });
        this.paqueteSeleccionado.set(null);
        this.quitarFoto();
        this.notificacion.exito('Membresía guardada con éxito.');
      },
      error: () => {
        this.guardandoMembresia = false;
        this.notificacion.error('No se pudo guardar la membresía.');
      }
    });
  }

  // 🖼️ Foto (solo local)
  onFotoSeleccionada(evt: Event): void {
    const file = (evt.target as HTMLInputElement).files?.[0] || null;
    if (!file) return;
    this.fotoArchivo = file;
    const reader = new FileReader();
    reader.onload = () => this.fotoPreviewUrl = reader.result as string;
    reader.readAsDataURL(file);
  }

  quitarFoto(): void {
    this.fotoArchivo = null;
    this.fotoPreviewUrl = null;
  }
}
