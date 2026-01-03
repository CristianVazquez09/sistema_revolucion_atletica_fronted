import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
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

type SocioRequest = Omit<SocioData, 'idSocio'> & { idSocio?: number };

type MembresiaPayload = Omit<
  MembresiaData,
  'paquete' | 'total' | 'fechaFin'
> & {
  paquete: { idPaquete: number };
};

// === Borrador en sessionStorage ===
const STORAGE_KEY_INSCRIPCION = 'ra_inscripcion_borrador_v1';

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

interface InscripcionDraft {
  form: InscripcionFormValue;
  huellaDigitalBase64: string | null;
  fotoPreviewUrl: string | null;
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

  listaPaquetes: PaqueteData[] = [];
  cargandoPaquetes = true;
  mostrarModalResumen = signal(false);
  mensajeError: string | null = null;
  guardandoMembresia = false;

  fotoArchivo: File | null = null;
  fotoPreviewUrl: string | null = null;

  // Huella (OPCIONAL)
  mostrarModalHuella = signal(false);
  huellaDigitalBase64: string | null = null;

  formularioInscripcion = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required]),
    apellido: this.fb.nonNullable.control('', [Validators.required]),
    telefono: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^[0-9]{10}$/),
    ]),
    email: this.fb.control<string | null>(null, [Validators.email]),
    fechaNacimiento: this.fb.control<string | null>(null),
    direccion: this.fb.nonNullable.control('', [Validators.required]),
    genero: this.fb.nonNullable.control<'MASCULINO' | 'FEMENINO'>('MASCULINO', [
      Validators.required,
    ]),
    comentarios: this.fb.control<string | null>(null),

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

  ngOnInit(): void {
    this.cargarContextoDesdeToken();

    // Cargar borrador previo (si existe)
    this.cargarBorradorDesdeStorage();

    this.cargarPaquetes();

    this.formularioInscripcion.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
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

    // Guardar borrador cada vez que cambie el formulario
    this.formularioInscripcion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.guardarBorradorEnStorage());
  }

  private cargarPaquetes(): void {
    this.cargandoPaquetes = true;
    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        const activos = (lista ?? []).filter((p) => p?.activo !== false);
        this.listaPaquetes = activos;
        this.cargandoPaquetes = false;
        this.store.dispatch(
          InscripcionActions.setListaPaquetes({ paquetes: activos })
        );

        const idInit = Number(
          this.formularioInscripcion.controls.paqueteId.value ?? 0
        );
        const valido = activos.some((p) => Number(p.idPaquete) === idInit)
          ? idInit
          : 0;

        if (valido !== idInit) {
          this.formularioInscripcion.controls.paqueteId.setValue(valido, {
            emitEvent: false,
          });
        }
        this.store.dispatch(
          InscripcionActions.setPaqueteId({ paqueteId: valido })
        );
      },
      error: () => {
        this.cargandoPaquetes = false;
        this.mensajeError = 'No se pudieron cargar los paquetes.';
      },
    });
  }

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

  cerrarModalResumen(): void {
    this.mostrarModalResumen.set(false);
  }

  private camposFaltantes(): string[] {
    const c = this.formularioInscripcion.controls;
    const f: string[] = [];
    if (c.nombre.invalid) f.push('Nombre');
    if (c.apellido.invalid) f.push('Apellidos');
    if (c.telefono.invalid) f.push('Teléfono (10 dígitos)');
    if (c.direccion.invalid) f.push('Dirección');
    if (!c.paqueteId.value || c.paqueteId.value <= 0) f.push('Paquete');
    if (c.genero.invalid) f.push('Sexo');
    return f;
  }

  // ===== Borrador: cargar/guardar en sessionStorage =====
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
    } catch {
      // Ignorar si hay error en el JSON
    }
  }

  private guardarBorradorEnStorage(): void {
    const formValue = this.formularioInscripcion.getRawValue();

    const draft: InscripcionDraft = {
      form: formValue as InscripcionFormValue,
      huellaDigitalBase64: this.huellaDigitalBase64,
      fotoPreviewUrl: this.fotoPreviewUrl,
    };

    try {
      sessionStorage.setItem(STORAGE_KEY_INSCRIPCION, JSON.stringify(draft));
    } catch {
      // Storage lleno o no disponible, lo ignoramos
    }
  }

  // ====== GUARDAR + TICKET ======
  confirmarPagoYGuardar(evento: PagoData[] | TipoPago): void {
    console.log('[INSCRIPCION] confirmarPagoYGuardar in', evento);

    const paquete = this.paqueteActualSig();
    if (!paquete) {
      this.notificacion.aviso('Selecciona un paquete antes de confirmar.');
      return;
    }

    // ✅ Huella ahora es OPCIONAL:
    //    Si this.huellaDigitalBase64 tiene valor, la enviamos.
    //    Si no, el socio se registra sin huella y luego se puede agregar aparte.

    const totalUI = this.totalVistaSig() ?? 0;

    // Normaliza el evento a un arreglo de pagos
    const pagos: PagoData[] = Array.isArray(evento)
      ? evento
      : [{ tipoPago: evento, monto: totalUI }];

    // Valida suma de pagos
    const sumaPagos = (pagos ?? []).reduce(
      (a, p) => a + (Number(p.monto) || 0),
      0
    );
    if (Math.abs(totalUI - sumaPagos) > 0.01) {
      this.notificacion.aviso('La suma de pagos no coincide con el total.');
      return;
    }

    const fechaInicio = this.fechaInicioSelSig() ?? hoyISO();

    // Construimos el socio sin exigir huella
    const socioNuevo: any = {
      nombre: this.formularioInscripcion.controls.nombre.value!,
      apellido: this.formularioInscripcion.controls.apellido.value!,
      direccion: this.formularioInscripcion.controls.direccion.value!,
      telefono: this.formularioInscripcion.controls.telefono.value!,
      email: this.formularioInscripcion.controls.email.value ?? '',
      fechaNacimiento:
        this.formularioInscripcion.controls.fechaNacimiento.value ?? '',
      genero: this.formularioInscripcion.controls.genero.value!,
      comentarios: this.formularioInscripcion.controls.comentarios.value ?? '',
    };

    // Si tenemos huella, la agregamos; si no, la omitimos
    if (this.huellaDigitalBase64) {
      socioNuevo.huellaDigital = this.huellaDigitalBase64;
    }

    const usuarioId = this.getUserIdFromToken();

    const cuerpo: MembresiaPayload = {
      socio: socioNuevo as SocioData,
      paquete: { idPaquete: paquete.idPaquete },
      fechaInicio,
      movimiento: this.formularioInscripcion.controls.movimiento.value!,
      pagos,
      descuento: this.descuentoSelSig() ?? 0,
    };

    this.guardandoMembresia = true;
    console.log('[INSCRIPCION] POST /membresias ->', cuerpo);

    this.membresiaSrv.guardar(cuerpo as unknown as MembresiaData).subscribe({
      next: (resp: any) => {
        // ===== Ticket =====
        const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);
        const socioNombre = `${this.formularioInscripcion.controls.nombre.value!} ${
          this.formularioInscripcion.controls.apellido.value!
        }`.trim();

        const pagosDet = (pagos ?? [])
          .filter((p) => (Number(p.monto) || 0) > 0)
          .map((p) => ({ metodo: p.tipoPago, monto: Number(p.monto) || 0 }));
        const folioTicket = resp?.folio 

        this.ticket.imprimirMembresiaDesdeContexto({
          ctx,
          folio: folioTicket,
          fecha: new Date(),
          socioNombre,
          paqueteNombre: paquete?.nombre ?? null,
          precioPaquete: Number(paquete?.precio ?? 0),
          descuento: Number(this.descuentoSelSig() ?? 0),
          costoInscripcion: Number(this.costoInscripcionSig() ?? 0),
          pagos: pagosDet,
          referencia: resp?.referencia,
        });

        // ===== Limpieza UI =====
        this.guardandoMembresia = false;
        this.cerrarModalResumen();

        // Limpiar huella y foto
        this.huellaDigitalBase64 = null;
        this.fotoArchivo = null;
        this.fotoPreviewUrl = null;

        // Borrar borrador de storage
        sessionStorage.removeItem(STORAGE_KEY_INSCRIPCION);

        // Resetear formulario con valores por defecto
        const hoy = hoyISO();
        this.formularioInscripcion.reset({
          genero: 'MASCULINO',
          movimiento: 'INSCRIPCION',
          fechaInicio: hoy,
          descuento: 0,
          paqueteId: 0,
        });
        this.formularioInscripcion.controls.paqueteId.setValue(0, {
          emitEvent: true,
        });
        this.formularioInscripcion.controls.descuento.setValue(0, {
          emitEvent: true,
        });
        this.formularioInscripcion.controls.fechaInicio.setValue(hoy, {
          emitEvent: true,
        });

        this.store.dispatch(InscripcionActions.reset());
        this.cargarPaquetes();

        this.notificacion.exito('Membresía guardada con éxito.');
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoMembresia = false;

        const detalleBackend =
          err?.error?.detail ||
          err?.error?.title ||
          err?.message ||
          'No se pudo guardar la membresía.';

        this.notificacion.error(detalleBackend);
      },
    });
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

      const idGym =
        decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gymSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => (this.gym = g),
          error: () => (this.gym = null),
        });
      }
    } catch {
      /* noop */
    }
  }

  // ===== Huella: abrir/cerrar y recibir =====
  abrirModalHuella(): void {
    this.mostrarModalHuella.set(true);
  }

  onHuellaCancel(): void {
    this.mostrarModalHuella.set(false);
  }

  onHuellaOk(res: { muestras: string[]; calidades: number[] }) {
    this.mostrarModalHuella.set(false);

    // Elegir la mejor (MENOR calidad, 0 = OK)
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

    this.notificacion?.exito?.(
      res.muestras.length > 1
        ? 'Huella registrada (se usará la de mejor calidad).'
        : 'Huella registrada.'
    );
  }

  private getUserIdFromToken(): number | null {
    const token = sessionStorage.getItem(environment.TOKEN_NAME);
    if (!token) return null;
    try {
      const d: any = this.jwt.decodeToken(token);
      const raw =
        d?.id_usuario ?? d?.userId ?? d?.uid ?? d?.id ?? d?.usuarioId ?? null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
}
