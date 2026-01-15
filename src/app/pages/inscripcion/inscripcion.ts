// pages/inscripcion/inscripcion.ts

import {
  Component,
  OnInit,
  signal,
  inject,
  DestroyRef,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ResumenCompra } from '../resumen-compra/resumen-compra';

import { PaqueteService } from '../../services/paquete-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';

import { PaqueteData } from '../../model/paquete-data';
import { SocioData } from '../../model/socio-data';
import { MembresiaData, PagoData } from '../../model/membresia-data';

import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { hoyISO } from '../../util/fechas-precios';
import { TipoPago } from '../../util/enums/tipo-pago';

import { JwtHelperService } from '@auth0/angular-jwt';
import { GimnasioService } from '../../services/gimnasio-service';
import { TicketService, VentaContexto } from '../../services/ticket-service';
import { GimnasioData } from '../../model/gimnasio-data';
import { environment } from '../../../environments/environment';
import { crearContextoTicket } from '../../util/ticket-contexto';

import { Store } from '@ngrx/store';
import { InscripcionActions } from './state/inscripcion-actions';
import {
  selectPaqueteActual,
  selectTotalVista,
  selectTotalSinDescuento,
  selectFechaPagoVista,
  selectDescuento,
  selectFechaInicio,
  selectPaqueteId,
  selectCostoInscripcion,
  selectPrecioPaquete,
} from './state/inscripcion-selectors';

import { HuellaModal } from '../huella-modal/huella-modal';
import { HttpErrorResponse } from '@angular/common/http';

type MembresiaPayload = Omit<MembresiaData, 'paquete' | 'total' | 'fechaFin'> & {
  paquete: { idPaquete: number };
};

// === Borrador en sessionStorage ===
const STORAGE_KEY_INSCRIPCION = 'ra_inscripcion_borrador_v3';

// ✅ Para que el template pueda usar p.modalidad sin casts
type PaqueteUI = PaqueteData & { modalidad?: any };

type InscripcionFormValue = {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string | null;
  fechaNacimiento: string | null;
  direccion: string;
  genero: 'MASCULINO' | 'FEMENINO';
  comentarios: string | null;
  paqueteId: number;
  fechaInicio: string;
  descuento: number;
  movimiento: TipoMovimiento;
};

type BatchDraftItem = {
  socioNombre: string;
  cuerpo: MembresiaPayload;
  pagos: PagoData[];
};

interface InscripcionDraft {
  form: InscripcionFormValue;
  huellaDigitalBase64: string | null;
  fotoPreviewUrl: string | null;
  batchDrafts?: BatchDraftItem[];
}

@Component({
  selector: 'app-inscripcion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ResumenCompra,
    TiempoPlanLabelPipe,
    HuellaModal,
  ],
  templateUrl: './inscripcion.html',
  styleUrl: './inscripcion.css',
})
export class Inscripcion implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private notificacion = inject(NotificacionService);

  constructor(
    private paqueteSrv: PaqueteService,
    private membresiaSrv: MembresiaService
  ) {}

  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt = inject(JwtHelperService);
  private store = inject(Store);

  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  listaPaquetes: PaqueteUI[] = [];
  cargandoPaquetes = true;

  mostrarModalResumen = signal(false);
  mostrarModalHuella = signal(false);

  mensajeError: string | null = null;
  guardandoMembresia = false;

  fotoArchivo: File | null = null;
  fotoPreviewUrl: string | null = null;

  // Huella (OPCIONAL)
  huellaDigitalBase64: string | null = null;

  // ✅ Lote capturado
  batchDraftsSig = signal<BatchDraftItem[]>([]);

  // ✅ edición de integrante capturado
  batchEditIndexSig = signal<number | null>(null);
  editandoIntegranteSig = computed(() => this.batchEditIndexSig() !== null);

  private backupAntesEditar: {
    form: InscripcionFormValue;
    huella: string | null;
    foto: string | null;
  } | null = null;

  formularioInscripcion = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required]),
    apellido: this.fb.nonNullable.control('', [Validators.required]),

    // ✅ AHORA OBLIGATORIO (10 dígitos)
    telefono: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^[0-9]{10}$/),
    ]),

    email: this.fb.control<string | null>(null, [Validators.email]),

    // ✅ requerido para abrir modal
    fechaNacimiento: this.fb.control<string | null>(null, [Validators.required]),

    direccion: this.fb.nonNullable.control('', [Validators.required]),
    genero: this.fb.nonNullable.control<'MASCULINO' | 'FEMENINO'>('MASCULINO', [
      Validators.required,
    ]),
    comentarios: this.fb.control<string | null>(null),

    // ✅ paquete necesario para cobrar
    paqueteId: this.fb.nonNullable.control(0, [Validators.min(1)]),
    fechaInicio: this.fb.nonNullable.control(hoyISO()),
    descuento: this.fb.nonNullable.control(0, [Validators.min(0)]),
    movimiento: this.fb.nonNullable.control<TipoMovimiento>('INSCRIPCION'),
  });

  // Selectores como signals
  paqueteActualSig = this.store.selectSignal(selectPaqueteActual);
  totalVistaSig = this.store.selectSignal(selectTotalVista);
  totalSinDescuentoSig = this.store.selectSignal(selectTotalSinDescuento);
  fechaPagoVistaSig = this.store.selectSignal(selectFechaPagoVista);
  descuentoSelSig = this.store.selectSignal(selectDescuento);
  fechaInicioSelSig = this.store.selectSignal(selectFechaInicio);
  paqueteIdSelSig = this.store.selectSignal(selectPaqueteId);
  costoInscripcionSig = this.store.selectSignal(selectCostoInscripcion);
  precioPaqueteSig = this.store.selectSignal(selectPrecioPaquete);

  // =========================
  // Modalidad → cantidad requerida
  // =========================
  private cantidadRequerida(modalidad: any): number {
    const m = String(modalidad ?? 'INDIVIDUAL').toUpperCase();
    if (m === 'DUO') return 2;
    if (m === 'TRIO') return 3;
    if (m === 'SQUAD') return 5;
    return 1;
  }

  modalidadTexto(modalidad: any): string {
    const m = String(modalidad ?? 'INDIVIDUAL').toUpperCase();
    if (m === 'DUO') return 'Dúo (2)';
    if (m === 'TRIO') return 'Trío (3)';
    if (m === 'SQUAD') return 'Squad (5)';
    return 'Individual (1)';
  }

  batchRequeridoSig = computed(() => {
    const p = this.paqueteActualSig();
    const modalidad = (p as any)?.modalidad;
    return this.cantidadRequerida(modalidad);
  });

  batchActivoSig = computed(() => this.batchRequeridoSig() > 1);
  batchIniciadoSig = computed(() => this.batchDraftsSig().length > 0);
  batchPasoSig = computed(() => this.batchDraftsSig().length + 1);

  conceptoResumenSig = computed(() => {
    const nombre = this.paqueteActualSig()?.nombre ?? 'Paquete seleccionado';
    if (!this.batchActivoSig()) return nombre;
    return `${nombre} · Integrante ${this.batchPasoSig()} de ${this.batchRequeridoSig()}`;
  });

  botonContinuarSig = computed(() => {
    if (!this.batchActivoSig()) return 'Continuar con el pago';
    const paso = this.batchPasoSig();
    const req = this.batchRequeridoSig();
    return paso < req
      ? `Cobrar integrante ${paso} y continuar`
      : `Cobrar integrante ${paso} y guardar lote (${req})`;
  });

  ngOnInit(): void {
    this.cargarContextoDesdeToken();
    this.cargarBorradorDesdeStorage();
    this.cargarPaquetes();

    this.formularioInscripcion.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (this.batchIniciadoSig()) {
          const actual = this.paqueteIdSelSig();
          this.formularioInscripcion.controls.paqueteId.setValue(
            Number(actual ?? 0),
            { emitEvent: false }
          );
          this.notificacion.aviso('Para cambiar de paquete, reinicia el lote.');
          return;
        }

        this.store.dispatch(
          InscripcionActions.setPaqueteId({ paqueteId: Number(id ?? 0) })
        );
        if (!this.formularioInscripcion.controls.fechaInicio.value) {
          this.formularioInscripcion.controls.fechaInicio.setValue(hoyISO(), {
            emitEvent: false,
          });
        }
      });

    this.formularioInscripcion.controls.descuento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) =>
        this.store.dispatch(
          InscripcionActions.setDescuento({ descuento: Number(d ?? 0) })
        )
      );

    this.formularioInscripcion.controls.fechaInicio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((f) =>
        this.store.dispatch(
          InscripcionActions.setFechaInicio({
            fechaInicio: String(f ?? hoyISO()),
          })
        )
      );

    this.formularioInscripcion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.guardarBorradorEnStorage());

    this.lockPaqueteControl(this.batchIniciadoSig());
  }

  // =========================
  // Lock/Unlock paqueteId
  // =========================
  private lockPaqueteControl(locked: boolean): void {
    const c = this.formularioInscripcion.controls.paqueteId;
    if (locked && c.enabled) c.disable({ emitEvent: false });
    if (!locked && c.disabled) c.enable({ emitEvent: false });
  }

  private cargarPaquetes(): void {
    this.cargandoPaquetes = true;
    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        const activos = (lista ?? []).filter((p) => p?.activo !== false);
        this.listaPaquetes = activos as PaqueteUI[];
        this.cargandoPaquetes = false;

        this.store.dispatch(
          InscripcionActions.setListaPaquetes({ paquetes: activos as any })
        );

        const idInit = Number(this.formularioInscripcion.controls.paqueteId.value ?? 0);
        const valido = activos.some((p) => Number(p.idPaquete) === idInit) ? idInit : 0;

        if (valido !== idInit) {
          this.formularioInscripcion.controls.paqueteId.setValue(valido, { emitEvent: false });
        }
        this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId: valido }));
      },
      error: () => {
        this.cargandoPaquetes = false;
        this.mensajeError = 'No se pudieron cargar los paquetes.';
      },
    });
  }

  socioNombreActual(): string {
    const n = this.formularioInscripcion.controls.nombre.value ?? '';
    const a = this.formularioInscripcion.controls.apellido.value ?? '';
    return `${n} ${a}`.trim();
  }

  // ✅ Para deshabilitar botón y bloquear apertura del modal
  puedeAbrirResumen(): boolean {
    return this.camposFaltantesParaResumen().length === 0;
  }

  abrirModalResumen(): void {
    if (this.guardandoMembresia) return;
    if (this.editandoIntegranteSig()) {
      this.notificacion.aviso('Estás editando un integrante capturado. Guarda o cancela la edición.');
      return;
    }

    const faltantes = this.camposFaltantesParaResumen();
    if (faltantes.length) {
      this.formularioInscripcion.markAllAsTouched();
      this.mensajeError = 'Completa: ' + faltantes.join(', ') + '.';
      return;
    }

    this.mensajeError = null;
    this.mostrarModalResumen.set(true);
  }

  cerrarModalResumen(): void {
    this.mostrarModalResumen.set(false);
  }

  // ✅ Reglas exactas para abrir el modal
  private camposFaltantesParaResumen(): string[] {
    const c = this.formularioInscripcion.controls;
    const f: string[] = [];

    if (c.nombre.invalid) f.push('Nombre');
    if (c.apellido.invalid) f.push('Apellidos');

    // ✅ ahora requerido
    if (c.telefono.invalid) f.push('Teléfono (10 dígitos)');
    if (c.fechaNacimiento.invalid) f.push('Fecha de nacimiento');

    if (c.direccion.invalid) f.push('Dirección');
    if (c.genero.invalid) f.push('Sexo');

    // ✅ necesario para calcular/cobrar
    if (!c.paqueteId.value || c.paqueteId.value <= 0) f.push('Paquete');

    return f;
  }

  // =========================
  // ✅ EDICIÓN DE INTEGRANTES CAPTURADOS
  // =========================
  private tomarBackupAntesEditar(): void {
    if (this.backupAntesEditar) return;
    this.backupAntesEditar = {
      form: this.formularioInscripcion.getRawValue() as InscripcionFormValue,
      huella: this.huellaDigitalBase64,
      foto: this.fotoPreviewUrl,
    };
  }

  editarIntegrante(index: number): void {
    if (this.guardandoMembresia) return;

    const drafts = this.batchDraftsSig();
    if (!drafts.length) return;
    if (index < 0 || index >= drafts.length) return;

    this.tomarBackupAntesEditar();

    const d = drafts[index];
    const socio: any = d?.cuerpo?.socio ?? {};

    this.formularioInscripcion.patchValue(
      {
        nombre: socio?.nombre ?? '',
        apellido: socio?.apellido ?? socio?.apellidos ?? '',
        telefono: String(socio?.telefono ?? ''),
        email: socio?.email ?? null,
        fechaNacimiento: socio?.fechaNacimiento ?? null,
        direccion: socio?.direccion ?? '',
        genero: (socio?.genero ?? 'MASCULINO') as any,
        comentarios: socio?.comentarios ?? null,
      },
      { emitEvent: false }
    );

    this.huellaDigitalBase64 = socio?.huellaDigital ?? null;

    this.batchEditIndexSig.set(index);
    this.mensajeError = null;
    this.guardarBorradorEnStorage();
    this.notificacion.aviso(`Editando integrante ${index + 1}.`);
  }

  editarAnteriorCapturado(): void {
    const drafts = this.batchDraftsSig();
    if (!drafts.length) return;

    const idx = this.batchEditIndexSig();
    const target = idx === null ? drafts.length - 1 : Math.max(0, idx - 1);
    this.editarIntegrante(target);
  }

  editarPrimeroCapturado(): void {
    const drafts = this.batchDraftsSig();
    if (!drafts.length) return;
    this.editarIntegrante(0);
  }

  cancelarEdicionIntegrante(): void {
    if (!this.backupAntesEditar) {
      this.batchEditIndexSig.set(null);
      return;
    }

    this.formularioInscripcion.patchValue(this.backupAntesEditar.form, { emitEvent: false });
    this.huellaDigitalBase64 = this.backupAntesEditar.huella;
    this.fotoPreviewUrl = this.backupAntesEditar.foto;

    this.batchEditIndexSig.set(null);
    this.backupAntesEditar = null;

    this.guardarBorradorEnStorage();
    this.notificacion.aviso('Edición cancelada.');
  }

  guardarEdicionIntegrante(): void {
    if (this.guardandoMembresia) return;

    const idx = this.batchEditIndexSig();
    if (idx === null) return;

    const faltantes = this.camposFaltantesParaResumen();
    if (faltantes.length) {
      this.formularioInscripcion.markAllAsTouched();
      this.mensajeError = 'Completa: ' + faltantes.join(', ') + '.';
      return;
    }

    const drafts = [...this.batchDraftsSig()];
    const target = drafts[idx];
    if (!target) return;

    // ✅ solo corregimos datos del socio (NO tocamos pagos ni montos)
    const socioNuevo: any = {
      ...((target.cuerpo?.socio as any) ?? {}),
      nombre: this.formularioInscripcion.controls.nombre.value!,
      apellido: this.formularioInscripcion.controls.apellido.value!,
      direccion: this.formularioInscripcion.controls.direccion.value!,
      telefono: this.formularioInscripcion.controls.telefono.value!,
      email: this.formularioInscripcion.controls.email.value ?? '',
      fechaNacimiento: this.formularioInscripcion.controls.fechaNacimiento.value ?? '',
      genero: this.formularioInscripcion.controls.genero.value!,
      comentarios: this.formularioInscripcion.controls.comentarios.value ?? '',
    };

    if (this.huellaDigitalBase64) {
      socioNuevo.huellaDigital = this.huellaDigitalBase64;
    } else {
      // si quieres permitir "quitar huella", descomenta:
      // delete socioNuevo.huellaDigital;
    }

    const socioNombre = this.socioNombreActual();

    drafts[idx] = {
      ...target,
      socioNombre,
      cuerpo: {
        ...target.cuerpo,
        socio: socioNuevo as SocioData,
      },
      // pagos se mantienen tal cual
      pagos: target.pagos,
    };

    this.batchDraftsSig.set(drafts);

    // restaurar lo que el usuario estaba escribiendo
    const backup = this.backupAntesEditar;
    this.batchEditIndexSig.set(null);
    this.backupAntesEditar = null;

    if (backup) {
      this.formularioInscripcion.patchValue(backup.form, { emitEvent: false });
      this.huellaDigitalBase64 = backup.huella;
      this.fotoPreviewUrl = backup.foto;
    }

    this.guardarBorradorEnStorage();
    this.notificacion.exito('Integrante actualizado.');
  }

  // =========================
  // Borrador
  // =========================
  private cargarBorradorDesdeStorage(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_INSCRIPCION);
      if (!raw) return;

      const draft = JSON.parse(raw) as InscripcionDraft;

      if (draft?.form) {
        this.formularioInscripcion.patchValue(draft.form, { emitEvent: false });
      }
      this.huellaDigitalBase64 = draft?.huellaDigitalBase64 ?? null;
      this.fotoPreviewUrl = draft?.fotoPreviewUrl ?? null;

      if (Array.isArray(draft?.batchDrafts)) {
        this.batchDraftsSig.set(draft.batchDrafts);
      }
    } catch {
      // noop
    }
  }

  private guardarBorradorEnStorage(): void {
    const formValue = this.formularioInscripcion.getRawValue();
    const draft: InscripcionDraft = {
      form: formValue as InscripcionFormValue,
      huellaDigitalBase64: this.huellaDigitalBase64,
      fotoPreviewUrl: this.fotoPreviewUrl,
      batchDrafts: this.batchDraftsSig(),
    };

    try {
      sessionStorage.setItem(STORAGE_KEY_INSCRIPCION, JSON.stringify(draft));
    } catch {
      // noop
    }
  }

  // =========================
  // Batch controls
  // =========================
  reiniciarLote(): void {
    if (this.guardandoMembresia) return;
    if (this.editandoIntegranteSig()) {
      this.notificacion.aviso('Primero guarda o cancela la edición.');
      return;
    }

    this.batchDraftsSig.set([]);
    this.lockPaqueteControl(false);
    this.guardarBorradorEnStorage();
    this.notificacion.aviso('Lote reiniciado.');
  }

  private limpiarParaSiguienteIntegrante(): void {
    const hoy = hoyISO();

    const paqueteId = Number(this.formularioInscripcion.controls.paqueteId.value ?? 0);
    const descuento = Number(this.formularioInscripcion.controls.descuento.value ?? 0);
    const movimiento = this.formularioInscripcion.controls.movimiento.value!;
    const fechaInicio = this.formularioInscripcion.controls.fechaInicio.value ?? hoy;

    this.formularioInscripcion.reset({
      nombre: '',
      apellido: '',
      telefono: '', // ✅ requerido
      email: null,

      fechaNacimiento: null, // ✅ requerido
      direccion: '',
      genero: 'MASCULINO',
      comentarios: null,

      paqueteId,
      fechaInicio,
      descuento,
      movimiento,
    });

    this.huellaDigitalBase64 = null;
    this.fotoArchivo = null;
    this.fotoPreviewUrl = null;

    this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId }));
    this.store.dispatch(InscripcionActions.setDescuento({ descuento }));
    this.store.dispatch(
      InscripcionActions.setFechaInicio({ fechaInicio: String(fechaInicio) })
    );

    this.guardarBorradorEnStorage();
  }

  // =========================
  // GUARDAR + BATCH
  // =========================
  confirmarPagoYGuardar(evento: PagoData[] | TipoPago): void {
    if (this.guardandoMembresia) return;
    if (this.editandoIntegranteSig()) {
      this.notificacion.aviso('Primero guarda o cancela la edición del integrante.');
      return;
    }

    const faltantes = this.camposFaltantesParaResumen();
    if (faltantes.length) {
      this.notificacion.aviso('Completa: ' + faltantes.join(', ') + '.');
      return;
    }

    const paquete = this.paqueteActualSig();
    if (!paquete) {
      this.notificacion.aviso('Selecciona un paquete antes de confirmar.');
      return;
    }

    const totalUI = this.totalVistaSig() ?? 0;

    const pagos: PagoData[] = Array.isArray(evento)
      ? evento
      : [{ tipoPago: evento, monto: totalUI }];

    const sumaPagos = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(totalUI - sumaPagos) > 0.01) {
      this.notificacion.aviso('La suma de pagos no coincide con el total.');
      return;
    }

    const fechaInicio = this.fechaInicioSelSig() ?? hoyISO();

    const socioNuevo: any = {
      nombre: this.formularioInscripcion.controls.nombre.value!,
      apellido: this.formularioInscripcion.controls.apellido.value!,
      direccion: this.formularioInscripcion.controls.direccion.value!,
      telefono: this.formularioInscripcion.controls.telefono.value!,
      email: this.formularioInscripcion.controls.email.value ?? '',
      fechaNacimiento: this.formularioInscripcion.controls.fechaNacimiento.value ?? '',
      genero: this.formularioInscripcion.controls.genero.value!,
      comentarios: this.formularioInscripcion.controls.comentarios.value ?? '',
    };

    if (this.huellaDigitalBase64) {
      socioNuevo.huellaDigital = this.huellaDigitalBase64;
    }

    const cuerpo: MembresiaPayload = {
      socio: socioNuevo as SocioData,
      paquete: { idPaquete: paquete.idPaquete },
      fechaInicio,
      movimiento: this.formularioInscripcion.controls.movimiento.value!,
      pagos,
      descuento: this.descuentoSelSig() ?? 0,
    };

    const socioNombre = this.socioNombreActual();

    const requerido = this.batchRequeridoSig();
    const esBatch = requerido > 1;

    // =========================
    // MODO INDIVIDUAL
    // =========================
    if (!esBatch) {
      this.guardandoMembresia = true;

      this.membresiaSrv.guardar(cuerpo as unknown as MembresiaData).subscribe({
        next: (resp: any) => {
          const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);

          const pagosDet = (pagos ?? [])
            .filter((p) => (Number(p.monto) || 0) > 0)
            .map((p) => ({ metodo: p.tipoPago, monto: Number(p.monto) || 0 }));

          this.ticket.imprimirMembresiaDesdeContexto({
            ctx,
            folio: resp?.folio,
            fecha: new Date(),
            socioNombre,
            paqueteNombre: paquete?.nombre ?? null,
            precioPaquete: Number(paquete?.precio ?? 0),
            descuento: Number(this.descuentoSelSig() ?? 0),
            costoInscripcion: Number(this.costoInscripcionSig() ?? 0),
            pagos: pagosDet,
            referencia: resp?.referencia,
          });

          this.guardandoMembresia = false;
          this.cerrarModalResumen();

          this.huellaDigitalBase64 = null;
          this.fotoArchivo = null;
          this.fotoPreviewUrl = null;

          sessionStorage.removeItem(STORAGE_KEY_INSCRIPCION);

          const hoy = hoyISO();
          this.formularioInscripcion.reset({
            genero: 'MASCULINO',
            movimiento: 'INSCRIPCION',
            fechaInicio: hoy,
            descuento: 0,
            paqueteId: 0,
            telefono: '',
            email: null,
            fechaNacimiento: null,
            comentarios: null,
          });

          this.store.dispatch(InscripcionActions.reset());
          this.cargarPaquetes();

          this.notificacion.exito('Membresía guardada con éxito.');
        },
        error: (err: HttpErrorResponse) => {
          this.guardandoMembresia = false;
          this.notificacion.error(this.extraerMensajeError(err));
        },
      });

      return;
    }

    // =========================
    // MODO BATCH (DUO/TRIO/SQUAD)
    // =========================
    const drafts = this.batchDraftsSig();
    const capturados = drafts.length;
    const esUltimo = capturados === (requerido - 1);

    // 1) NO es último -> agregar a drafts y limpiar
    if (!esUltimo) {
      const nuevos = [...drafts, { socioNombre, cuerpo, pagos }];
      this.batchDraftsSig.set(nuevos);

      this.lockPaqueteControl(true);
      this.guardarBorradorEnStorage();

      this.cerrarModalResumen();
      this.notificacion.exito(
        `Integrante ${nuevos.length}/${requerido} capturado. Continúa con el siguiente.`
      );
      this.limpiarParaSiguienteIntegrante();
      return;
    }

    // 2) último -> no lo agregamos a drafts antes, para evitar duplicados al fallar
    const fullDrafts: BatchDraftItem[] = [...drafts, { socioNombre, cuerpo, pagos }];
    const membresiasArray = fullDrafts.map((x) => x.cuerpo);

    this.guardandoMembresia = true;

    this.membresiaSrv.guardarBatch(membresiasArray).subscribe({
      next: (respList: any[]) => {
        const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);

        for (let i = 0; i < (respList ?? []).length; i++) {
          const resp = respList[i];
          const d = fullDrafts[i];

          const pagosDet = (d.pagos ?? [])
            .filter((p) => (Number(p.monto) || 0) > 0)
            .map((p) => ({ metodo: p.tipoPago, monto: Number(p.monto) || 0 }));

          this.ticket.imprimirMembresiaDesdeContexto({
            ctx,
            folio: resp?.folio,
            fecha: new Date(),
            socioNombre: resp?.socio
              ? `${resp.socio.nombre} ${resp.socio.apellido ?? resp.socio.apellidos ?? ''}`.trim()
              : d.socioNombre,
            paqueteNombre: resp?.paquete?.nombre ?? paquete?.nombre ?? null,
            precioPaquete: Number(resp?.paquete?.precio ?? this.precioPaqueteSig() ?? 0),
            descuento: Number(resp?.descuento ?? d.cuerpo?.descuento ?? 0),
            costoInscripcion: Number(resp?.paquete?.costoInscripcion ?? this.costoInscripcionSig() ?? 0),
            pagos: pagosDet,
            referencia: resp?.referencia,
          });
        }

        this.guardandoMembresia = false;
        this.cerrarModalResumen();

        this.batchDraftsSig.set([]);
        this.lockPaqueteControl(false);

        this.huellaDigitalBase64 = null;
        this.fotoArchivo = null;
        this.fotoPreviewUrl = null;

        sessionStorage.removeItem(STORAGE_KEY_INSCRIPCION);

        const hoy = hoyISO();
        this.formularioInscripcion.reset({
          genero: 'MASCULINO',
          movimiento: 'INSCRIPCION',
          fechaInicio: hoy,
          descuento: 0,
          paqueteId: 0,
          telefono: '',
          email: null,
          fechaNacimiento: null,
          comentarios: null,
        });

        this.store.dispatch(InscripcionActions.reset());
        this.cargarPaquetes();

        this.notificacion.exito(`Lote guardado con éxito (${requerido} membresías).`);
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoMembresia = false;

        this.lockPaqueteControl(true);
        this.guardarBorradorEnStorage();

        this.notificacion.error(this.extraerMensajeError(err));
      },
    });
  }

  private extraerMensajeError(err: HttpErrorResponse): string {
    const e: any = err?.error;

    if (e?.detail) return String(e.detail);
    if (e?.title) return String(e.title);
    if (e?.message) return String(e.message);
    if (typeof e === 'string') return e;

    return err?.message || 'No se pudo guardar. Revisa el payload.';
  }

  // Foto
  onFotoSeleccionada(evt: Event): void {
    const file = (evt.target as HTMLInputElement).files?.[0] || null;
    if (!file) return;
    this.fotoArchivo = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.fotoPreviewUrl = reader.result as string;
      this.guardarBorradorEnStorage();
    };
    reader.readAsDataURL(file);
  }

  quitarFoto(): void {
    this.fotoArchivo = null;
    this.fotoPreviewUrl = null;
    this.guardarBorradorEnStorage();
  }

  private cargarContextoDesdeToken(): void {
    const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!token) return;

    try {
      const decoded: any = this.jwt.decodeToken(token);
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;

      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gymSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => (this.gym = g),
          error: () => (this.gym = null),
        });
      }
    } catch {
      // noop
    }
  }

  // Huella
  abrirModalHuella(): void {
    this.mostrarModalHuella.set(true);
  }

  onHuellaCancel(): void {
    this.mostrarModalHuella.set(false);
  }

  onHuellaOk(res: { muestras: string[]; calidades: number[] }) {
    this.mostrarModalHuella.set(false);

    let idx = 0;
    if (
      Array.isArray(res.calidades) &&
      res.calidades.length === res.muestras.length &&
      res.calidades.length > 0
    ) {
      let best = Number.POSITIVE_INFINITY;
      res.calidades.forEach((q, i) => {
        if (q < best) {
          best = q;
          idx = i;
        }
      });
    }
    this.huellaDigitalBase64 = res.muestras[idx] ?? null;

    this.guardarBorradorEnStorage();

    this.notificacion.exito(
      res.muestras.length > 1
        ? 'Huella registrada (se usará la de mejor calidad).'
        : 'Huella registrada.'
    );
  }
}
