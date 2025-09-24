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
import { MembresiaData } from '../../model/membresia-data';

import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { calcularFechaFin, hoyISO } from '../../util/fechas-precios';
import { TipoPago } from '../../util/enums/tipo-pago';

// Ticket
import { JwtHelperService } from '@auth0/angular-jwt';
import { GimnasioService } from '../../services/gimnasio-service';
import { TicketService, VentaContexto } from '../../services/ticket-service';
import { GimnasioData } from '../../model/gimnasio-data';
import { environment } from '../../../environments/environment';
import { crearContextoTicket } from '../../util/ticket-contexto';

// NgRx (feature Inscripción)
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
  selectPrecioPaquete
} from './state/inscripcion-selectors';

type SocioRequest = Omit<SocioData, 'idSocio'> & { idSocio?: number };

@Component({
  selector: 'app-inscripcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ResumenCompra, TiempoPlanLabelPipe],
  templateUrl: './inscripcion.html',
  styleUrl: './inscripcion.css'
})
export class Inscripcion implements OnInit {
  // Inyecciones base
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private notificacion = inject(NotificacionService);

  // Servicios de dominio
  constructor(
    private paqueteSrv: PaqueteService,
    private membresiaSrv: MembresiaService
  ) {}

  // Ticket
  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt    = inject(JwtHelperService);

  // NgRx store
  private store = inject(Store);

  // Contexto (ticket)
  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // Estado UI local (no de dominio)
  listaPaquetes: PaqueteData[] = [];
  cargandoPaquetes = true;
  mostrarModalResumen = signal(false);
  mensajeError: string | null = null;
  guardandoMembresia = false;

  // Foto (solo local)
  fotoArchivo: File | null = null;
  fotoPreviewUrl: string | null = null;

  // Formulario (UI)
  formularioInscripcion = this.fb.group({
    nombre:           this.fb.nonNullable.control('', [Validators.required]),
    apellido:         this.fb.nonNullable.control('', [Validators.required]),
    telefono:         this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
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

  // Signals derivados DESDE EL STORE (no calculamos en el componente)
  paqueteActualSig       = this.store.selectSignal(selectPaqueteActual);
  totalVistaSig          = this.store.selectSignal(selectTotalVista);
  totalSinDescuentoSig   = this.store.selectSignal(selectTotalSinDescuento);
  fechaPagoVistaSig      = this.store.selectSignal(selectFechaPagoVista);
  descuentoSelSig        = this.store.selectSignal(selectDescuento);
  fechaInicioSelSig      = this.store.selectSignal(selectFechaInicio);
  paqueteIdSelSig        = this.store.selectSignal(selectPaqueteId);
  costoInscripcionSig    = this.store.selectSignal(selectCostoInscripcion);
  precioPaqueteSig = this.store.selectSignal(selectPrecioPaquete); // 👈 NUEVO
// descuentoSelSig ya lo tienes (selectDescuento)


  // Ciclo de vida
  ngOnInit(): void {
    this.cargarContextoDesdeToken();
    this.cargarPaquetes();

    // Sincroniza cambios del form -> Store (única fuente de verdad de la feature)
    this.formularioInscripcion.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => {
        this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId: Number(id ?? 0) }));
        // Asegura fechaInicio definida (regla de UI)
        if (!this.formularioInscripcion.controls.fechaInicio.value) {
          this.formularioInscripcion.controls.fechaInicio.setValue(hoyISO(), { emitEvent: false });
        }
      });

    this.formularioInscripcion.controls.descuento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(d => this.store.dispatch(InscripcionActions.setDescuento({ descuento: Number(d ?? 0) })));

    this.formularioInscripcion.controls.fechaInicio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(f => this.store.dispatch(InscripcionActions.setFechaInicio({ fechaInicio: String(f ?? hoyISO()) })));
  }

  // Paquetes
  private cargarPaquetes(): void {
    this.cargandoPaquetes = true;
    this.paqueteSrv.buscarTodos().subscribe({
      next: lista => {
        this.listaPaquetes = lista ?? [];
        this.cargandoPaquetes = false;

        // Pasa al store (para selectores puros)
        this.store.dispatch(InscripcionActions.setListaPaquetes({ paquetes: this.listaPaquetes }));

        // Sincroniza paqueteId inicial del form -> store
        const idInit = Number(this.formularioInscripcion.controls.paqueteId.value ?? 0);
        this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId: idInit }));
      },
      error: () => {
        this.cargandoPaquetes = false;
        this.mensajeError = 'No se pudieron cargar los paquetes.';
      }
    });
  }

  // Modal
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

  // Guardar + Ticket (delegado)
  confirmarPagoYGuardar(tipoPago: TipoPago): void {
    // Obtenemos estado desde el store (no recomputamos)
    const paquete = this.paqueteActualSig();
    if (!paquete) {
      this.notificacion.aviso('Selecciona un paquete antes de confirmar.');
      return;
    }

    const fechaInicio = this.fechaInicioSelSig() ?? hoyISO();
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
      paquete: paquete, // si backend prefiere id: { idPaquete: paquete.idPaquete } as any
      fechaInicio,
      fechaFin,
      movimiento: this.formularioInscripcion.controls.movimiento.value!,
      tipoPago,
      descuento: this.descuentoSelSig(),
      total: this.totalSinDescuentoSig() // para backend (el ticket NO depende de esto)
    };

    this.guardandoMembresia = true;
    this.membresiaSrv.guardar(cuerpo).subscribe({
      next: (resp: any) => {
        // Ticket des acoplado: TicketService calcula importe con utilidades
        const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);
        const socioNombre = `${this.formularioInscripcion.controls.nombre.value!} ${this.formularioInscripcion.controls.apellido.value!}`.trim();

        this.ticket.verMembresiaDesdeContexto({
          ctx,
          folio: resp?.idMembresia ?? resp?.id ?? '',
          fecha: new Date(), // o resp?.fechaInicio
          socioNombre,
          paqueteNombre: paquete?.nombre ?? null,
          precioPaquete: Number(paquete?.precio ?? 0),
          descuento: Number(this.descuentoSelSig() ?? 0),
          costoInscripcion: Number(this.costoInscripcionSig() ?? 0),
          tipoPago: String(tipoPago)
        });

        // Limpieza UI
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

        // Resetea slice de feature
        this.store.dispatch(InscripcionActions.reset());

        this.quitarFoto();
        this.notificacion.exito('Membresía guardada con éxito.');
      },
      error: () => {
        this.guardandoMembresia = false;
        this.notificacion.error('No se pudo guardar la membresía.');
      }
    });
  }

  // Foto (solo local)
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

  // Contexto: cajero + gimnasio (para ticket)
  private cargarContextoDesdeToken(): void {
    const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!token) return;

    try {
      const decoded: any = this.jwt.decodeToken(token);

      // Cajero (username del token)
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;

      // id del gimnasio (según tu token)
      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gymSrv.buscarPorId(Number(idGym)).subscribe({
          next: g => this.gym = g,
          error: () => this.gym = null
        });
      }
    } catch {
      // token inválido → usar fallbacks
    }
  }
}
