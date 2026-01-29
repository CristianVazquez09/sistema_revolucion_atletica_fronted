// pages/inscripcion/inscripcion.ts

import {
  Component,
  OnInit,
  signal,
  inject,
  DestroyRef,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap } from 'rxjs';

import { ResumenCompra } from '../resumen-compra/resumen-compra';
import { HuellaModal } from '../huella-modal/huella-modal';

import { PaqueteService } from '../../services/paquete-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';
import { GimnasioService } from '../../services/gimnasio-service';
import { TicketService, VentaContexto } from '../../services/ticket-service';

import { PaqueteData } from '../../model/paquete-data';
import { SocioData } from '../../model/socio-data';
import { MembresiaData, PagoData } from '../../model/membresia-data';
import { GimnasioData } from '../../model/gimnasio-data';

import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { TipoPago } from '../../util/enums/tipo-pago';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { calcularTotal, hoyISO } from '../../util/fechas-precios';
import { crearContextoTicket } from '../../util/ticket-contexto';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';

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

type MembresiaPayload = Omit<MembresiaData, 'paquete' | 'total' | 'fechaFin'> & {
  paquete: { idPaquete: number };
};

// === Borrador en sessionStorage ===
const STORAGE_KEY_INSCRIPCION = 'ra_inscripcion_borrador_v3';

// ✅ Para que el template pueda usar p.modalidad / p.estudiantil sin casts
type PaqueteUI = PaqueteData & { modalidad?: any; estudiantil?: boolean };

// ✅ Promoción (UI)
type PromocionUI = {
  idPromocion?: number;
  nombre?: string;
  descripcion?: string;
  tipo?: string;
  descuentoMonto?: number;
  descuentoPorcentaje?: number;
  mesesGratis?: number;
  sinCostoInscripcion?: boolean;
  fechaInicio?: string;
  fechaFin?: string;
  activo?: boolean;
};

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

  // ✅ estudiante
  credencialEstudianteVigencia: string | null;
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

  // =====================================================
  // ✅ FIX CD: tick signal para que el template reaccione
  // (especialmente en apps zoneless / signals-first)
  // =====================================================
  private formTickSig = signal(0);
  private bumpFormTick(): void {
    this.formTickSig.update((v) => v + 1);
  }

  // =========================
  // ✅ PAQUETES (lista + buscador)
  // =========================
  listaPaquetesSig = signal<PaqueteUI[]>([]);
  cargandoPaquetes = true;

  paqueteBusquedaSig = signal<string>('');
  paqueteDropdownAbiertoSig = signal(false);
  paqueteBuscandoSig = signal(false);
  paqueteBusquedaErrorSig = signal<string | null>(null);
  paquetesResultadosSig = signal<PaqueteUI[]>([]);
  paqueteBloqueadoSig = signal(false);
  private paqueteBuscar$ = new Subject<string>();

  paquetesSugeridosSig = computed<PaqueteUI[]>(() => {
    const q = (this.paqueteBusquedaSig() ?? '').trim();
    const lista = this.listaPaquetesSig() ?? [];
    if (q.length < 2) return lista.slice(0, 12);
    return this.paquetesResultadosSig() ?? [];
  });

  mostrarModalResumen = signal(false);
  mostrarModalHuella = signal(false);

  mensajeError: string | null = null;
  guardandoMembresia = false;

  fotoArchivo: File | null = null;
  fotoPreviewUrl: string | null = null;

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

  // =========================
  // Form
  // =========================
  formularioInscripcion = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required]),
    apellido: this.fb.nonNullable.control('', [Validators.required]),

    telefono: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.pattern(/^[0-9]{10}$/),
    ]),

    email: this.fb.control<string | null>(null, [Validators.email]),
    fechaNacimiento: this.fb.control<string | null>(null, [Validators.required]),
    direccion: this.fb.nonNullable.control('', [Validators.required]),
    genero: this.fb.nonNullable.control<'MASCULINO' | 'FEMENINO'>('MASCULINO', [
      Validators.required,
    ]),
    comentarios: this.fb.control<string | null>(null),

    paqueteId: this.fb.nonNullable.control(0, [Validators.min(1)]),
    fechaInicio: this.fb.nonNullable.control(hoyISO()),
    descuento: this.fb.nonNullable.control(0, [Validators.min(0)]),
    movimiento: this.fb.nonNullable.control<TipoMovimiento>('INSCRIPCION'),

    credencialEstudianteVigencia: this.fb.control<string | null>(null),
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
  // ✅ Promociones (por paquete)
  // =========================
  promoCargandoSig = signal(false);
  promocionesVigentesSig = signal<PromocionUI[]>([]);
  promoErrorSig = signal<string | null>(null);

  promocionAplicadaSig = computed<PromocionUI | null>(() => {
    const lista = this.promocionesVigentesSig();
    const precio = Number(this.precioPaqueteSig() ?? 0);
    const insc = Number(this.costoInscripcionSig() ?? 0);
    return this.seleccionarMejorPromocion(lista, precio, insc);
  });

  promoInscripcionGratisSig = computed(() =>
    Boolean((this.promocionAplicadaSig() as any)?.sinCostoInscripcion === true)
  );

  promoMesesGratisSig = computed(() =>
    Math.max(0, Number((this.promocionAplicadaSig() as any)?.mesesGratis ?? 0))
  );

  promoDescuentoMontoSig = computed(() => {
    const promo: any = this.promocionAplicadaSig();
    if (!promo) return 0;

    const precio = Number(this.precioPaqueteSig() ?? 0);
    const tipo = String(promo?.tipo ?? '').toUpperCase();

    let monto = 0;
    if (tipo === 'DESCUENTO_PORCENTAJE' || tipo === 'PORCENTAJE') {
      const pct = Number(promo?.descuentoPorcentaje ?? 0);
      monto = (precio * pct) / 100;
    } else if (tipo === 'DESCUENTO_MONTO' || tipo === 'MONTO') {
      monto = Number(promo?.descuentoMonto ?? 0);
    } else {
      monto = Number(promo?.descuento ?? 0);
    }

    if (!Number.isFinite(monto) || monto < 0) monto = 0;
    return this.round2(Math.min(monto, precio));
  });

  // ✅ descuento TOTAL que se envía al backend
  descuentoTotalSig = computed(() => {
    const descManual = Math.max(0, Number(this.descuentoSelSig() ?? 0));
    const descPromo = Math.max(0, Number(this.promoDescuentoMontoSig() ?? 0));

    const insc = Math.max(0, Number(this.costoInscripcionSig() ?? 0));
    const inscGratis = this.promoInscripcionGratisSig() ? insc : 0;

    return this.round2(descManual + descPromo + inscGratis);
  });

  totalConPromoSig = computed(() => {
    const precio = Math.max(0, Number(this.precioPaqueteSig() ?? 0));
    const insc = Math.max(0, Number(this.costoInscripcionSig() ?? 0));
    const desc = Math.max(0, Number(this.descuentoTotalSig() ?? 0));
    return calcularTotal(precio, desc, insc);
  });

  totalSinPromoSig = computed(() => {
    const precio = Math.max(0, Number(this.precioPaqueteSig() ?? 0));
    const insc = Math.max(0, Number(this.costoInscripcionSig() ?? 0));
    const descManual = Math.max(0, Number(this.descuentoSelSig() ?? 0));
    return calcularTotal(precio, descManual, insc);
  });

  ahorroPromoSig = computed(() => {
    const ahorro = Number(this.totalSinPromoSig() ?? 0) - Number(this.totalConPromoSig() ?? 0);
    return this.round2(Math.max(0, ahorro));
  });

  promoBadgeTextoSig = computed(() => {
    const promo: any = this.promocionAplicadaSig();
    if (!promo) return null;

    const parts: string[] = [];
    const tipo = String(promo?.tipo ?? '').toUpperCase();

    if (tipo === 'DESCUENTO_PORCENTAJE' || tipo === 'PORCENTAJE') {
      const pct = Number(promo?.descuentoPorcentaje ?? 0);
      if (pct > 0) parts.push(`-${pct}%`);
    } else {
      const m = this.promoDescuentoMontoSig();
      if (m > 0) parts.push(`-$${m.toFixed(2)}`);
    }

    if (this.promoInscripcionGratisSig()) parts.push('Inscripción gratis');

    const mg = this.promoMesesGratisSig();
    if (mg > 0) parts.push(`+${mg} mes(es) gratis`);

    return parts.filter(Boolean).join(' · ') || 'Promoción activa';
  });

  // ✅ Congelar valores del modal de cobro
  totalEnModalSig = signal<number>(0);
  montoPaqueteEnModalSig = signal<number>(0);
  montoInscripcionEnModalSig = signal<number>(0);
  descuentoEnModalSig = signal<number>(0);

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

  // ✅ estudiante
  esPaqueteEstudiantilSig = computed(() => {
    const p: any = this.paqueteActualSig() as any;
    return Boolean(p?.estudiantil === true);
  });

  conceptoResumenSig = computed(() => {
    const nombrePaquete = this.paqueteActualSig()?.nombre ?? 'Paquete seleccionado';
    const promo: any = this.promocionAplicadaSig();
    const promoTxt = promo?.nombre ? ` · Promo: ${promo.nombre}` : '';

    if (!this.batchActivoSig()) return `${nombrePaquete}${promoTxt}`;
    return `${nombrePaquete} · Integrante ${this.batchPasoSig()} de ${this.batchRequeridoSig()}${promoTxt}`;
  });

  botonContinuarSig = computed(() => {
    if (!this.batchActivoSig()) return 'Continuar con el pago';
    const paso = this.batchPasoSig();
    const req = this.batchRequeridoSig();
    return paso < req
      ? `Cobrar integrante ${paso} y continuar`
      : `Cobrar integrante ${paso} y guardar lote (${req})`;
  });

  // =====================================================
  // ✅ Señal reactiva para habilitar botón (FIX)
  // =====================================================
  puedeAbrirResumenSig = computed(() => {
    // depende del tick para re-render aunque sea zoneless
    this.formTickSig();

    return this.camposFaltantesParaResumen().length === 0 && !this.promoCargandoSig();
  });

  resumenResetKeySig = signal(0);

  ngOnInit(): void {
    this.cargarContextoDesdeToken();
    this.cargarBorradorDesdeStorage();
    this.cargarPaquetes();

    // ✅ buscador paquetes (debounced)
    this.paqueteBuscar$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((raw) => {
          const q = (raw ?? '').trim();

          this.paqueteBusquedaErrorSig.set(null);

          if (this.paqueteBloqueadoSig()) {
            this.paqueteBuscandoSig.set(false);
            return of([] as PaqueteUI[]);
          }

          if (q.length < 2) {
            this.paqueteBuscandoSig.set(false);
            return of([] as PaqueteUI[]);
          }

          this.paqueteBuscandoSig.set(true);
          return this.paqueteSrv.buscarPorNombre(q, true).pipe(
            map((lista) => {
              const arr = Array.isArray(lista) ? lista : [];
              return arr.map((x) => this.normalizePaquete(x)) as PaqueteUI[];
            }),
            catchError((err) => {
              this.paqueteBusquedaErrorSig.set(this.extraerMensajeError(err));
              return of([] as PaqueteUI[]);
            }),
            finalize(() => this.paqueteBuscandoSig.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((lista) => this.paquetesResultadosSig.set(lista ?? []));

    // ✅ mantener input mostrando el paquete seleccionado (y revertir cuando se cierra)
    effect(() => {
      const dropdownOpen = this.paqueteDropdownAbiertoSig();
      if (dropdownOpen) return;

      const id = Number(this.paqueteIdSelSig() ?? 0);
      const lista = this.listaPaquetesSig();
      const sel = (lista ?? []).find((p) => Number(p.idPaquete) === id);

      if (sel) this.paqueteBusquedaSig.set(this.paqueteLabel(sel));
    });

    // paqueteId (si cambia por UI nativa / restore)
    this.formularioInscripcion.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        this.bumpFormTick();

        if (this.batchIniciadoSig()) {
          const actual = this.paqueteIdSelSig();
          this.formularioInscripcion.controls.paqueteId.setValue(Number(actual ?? 0), {
            emitEvent: false,
          });
          this.notificacion.aviso('Para cambiar de paquete, reinicia el lote.');
          this.bumpFormTick();
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

        this.syncValidadoresEstudiantePorPaqueteId(Number(id ?? 0));
        this.cargarPromocionesPorPaquete(Number(id ?? 0));

        if (!this.paqueteDropdownAbiertoSig()) {
          const lista = this.listaPaquetesSig();
          const sel = (lista ?? []).find((p) => Number(p.idPaquete) === Number(id ?? 0));
          if (sel) this.paqueteBusquedaSig.set(this.paqueteLabel(sel));
        }

        this.bumpFormTick();
      });

    // descuento → store
    this.formularioInscripcion.controls.descuento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) => {
        this.store.dispatch(
          InscripcionActions.setDescuento({ descuento: Number(d ?? 0) })
        );
        this.bumpFormTick();
      });

    // fechaInicio → store
    this.formularioInscripcion.controls.fechaInicio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((f) => {
        this.store.dispatch(
          InscripcionActions.setFechaInicio({ fechaInicio: String(f ?? hoyISO()) })
        );
        this.bumpFormTick();
      });

    // ✅ FIX: valueChanges/statusChanges → tick + persist
    this.formularioInscripcion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.guardarBorradorEnStorage();
        this.bumpFormTick();
      });

    this.formularioInscripcion.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.bumpFormTick());

    this.lockPaqueteControl(this.batchIniciadoSig());

    // sync validadores por paquete actual del draft
    this.syncValidadoresEstudiantePorPaqueteId(
      Number(this.formularioInscripcion.controls.paqueteId.value ?? 0)
    );

    this.cargarPromocionesPorPaquete(
      Number(this.formularioInscripcion.controls.paqueteId.value ?? 0)
    );

    this.bumpFormTick();
  }

  // =========================
  // ✅ Buscador Paquetes - helpers FIX
  // =========================
  private paqueteLabel(p: PaqueteUI): string {
    return String(p?.nombre ?? '').trim();
  }

  private normalizarPaqueteSeleccionado(p: PaqueteUI): PaqueteUI {
    const picked = this.normalizePaquete(p);
    const id = this.getPaqueteId(picked);
    if (!id) return picked;

    const lista = this.listaPaquetesSig() ?? [];
    const existente = lista.find((x) => this.getPaqueteId(x) === id);
    if (existente) return existente;

    const nueva = [...lista, picked]
      .filter((x) => x && this.getPaqueteId(x) > 0)
      .reduce(
        (acc, item) => {
          const key = this.getPaqueteId(item);
          if (!acc.map.has(key)) {
            acc.map.set(key, true);
            acc.arr.push(item);
          }
          return acc;
        },
        { map: new Map<number, boolean>(), arr: [] as PaqueteUI[] }
      ).arr;

    this.listaPaquetesSig.set(nueva);
    this.store.dispatch(InscripcionActions.setListaPaquetes({ paquetes: nueva as any }));

    return picked;
  }

  abrirDropdownPaquetes(): void {
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;
    this.paqueteDropdownAbiertoSig.set(true);
    this.paqueteBuscar$.next(this.paqueteBusquedaSig());
  }

  cerrarDropdownPaquetes(): void {
    const wasOpen = this.paqueteDropdownAbiertoSig();
    this.paqueteDropdownAbiertoSig.set(false);
    this.paquetesResultadosSig.set([]);

    if (!wasOpen) return;

    const id =
      Number(this.formularioInscripcion.controls.paqueteId.value ?? 0) ||
      Number(this.paqueteIdSelSig() ?? 0);

    const lista = this.listaPaquetesSig();
    const sel = (lista ?? []).find((p) => Number(p.idPaquete) === Number(id));
    if (sel) this.paqueteBusquedaSig.set(this.paqueteLabel(sel));
  }

  onPaqueteBusquedaChange(v: string): void {
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    this.paqueteBusquedaSig.set(v);
    this.paqueteDropdownAbiertoSig.set(true);
    this.paqueteBuscar$.next(v);
  }

  seleccionarPaqueteDesdeBusqueda(p: PaqueteUI, evt?: Event): void {
    evt?.stopPropagation();
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    const picked = this.normalizePaquete(p);
    const id = this.getPaqueteId(picked);

    if (!id || id <= 0) {
      this.notificacion.error('No se pudo seleccionar el paquete (id inválido).');
      return;
    }

    const master = (this.listaPaquetesSig() ?? []).find((x) => this.getPaqueteId(x) === id);
    const real = master ?? this.normalizarPaqueteSeleccionado(picked);

    this.aplicarSeleccionPaquete(id, real);

    this.paqueteDropdownAbiertoSig.set(false);
    this.paquetesResultadosSig.set([]);

    this.bumpFormTick();
  }

  limpiarPaqueteSeleccionado(evt?: Event): void {
    evt?.stopPropagation();
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    this.formularioInscripcion.controls.paqueteId.setValue(0, { emitEvent: false });
    this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId: 0 }));

    this.paqueteBusquedaSig.set('');
    this.paquetesResultadosSig.set([]);
    this.paqueteDropdownAbiertoSig.set(false);

    this.promocionesVigentesSig.set([]);
    this.promoErrorSig.set(null);

    this.bumpFormTick();
  }

  // =========================
  // Lock/Unlock paqueteId
  // =========================
  private lockPaqueteControl(locked: boolean): void {
    this.paqueteBloqueadoSig.set(locked);
    if (locked) this.cerrarDropdownPaquetes();
  }

 private cargarPaquetes(): void {
  this.cargandoPaquetes = true;

  this.paqueteSrv.buscarTodos().subscribe({
    next: (lista) => {
      const activos = (lista ?? [])
        .map((x) => this.normalizePaquete(x))
        .filter((p) => p?.activo !== false && this.getPaqueteId(p) > 0) as PaqueteUI[];

      this.listaPaquetesSig.set(activos);
      this.store.dispatch(InscripcionActions.setListaPaquetes({ paquetes: activos as any }));

      // ✅ 1) preferir form (borrador), si no, store, si no 0
      const idForm = Number(this.formularioInscripcion.controls.paqueteId.value ?? 0);
      const idStore = Number(this.paqueteIdSelSig() ?? 0);
      const idPreferido = idForm > 0 ? idForm : (idStore > 0 ? idStore : 0);

      // ✅ 2) validar que exista en la lista
      const existe = activos.some((p) => Number(p.idPaquete) === idPreferido);
      const idFinal = existe ? idPreferido : 0;

      // ✅ 3) aplicar selección (esto pinta el input + promos + validadores)
      if (idFinal > 0) {
        const sel = activos.find((p) => Number(p.idPaquete) === idFinal);
        this.aplicarSeleccionPaquete(idFinal, sel);
      } else {
        // dejar todo limpio
        this.formularioInscripcion.controls.paqueteId.setValue(0, { emitEvent: false });
        this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId: 0 }));
        this.paqueteBusquedaSig.set('');
        this.promocionesVigentesSig.set([]);
        this.promoErrorSig.set(null);
        this.syncValidadoresEstudiantePorPaqueteId(0);
      }

      this.cargandoPaquetes = false;
      this.bumpFormTick();
    },
    error: () => {
      this.cargandoPaquetes = false;
      this.mensajeError = 'No se pudieron cargar los paquetes.';
      this.bumpFormTick();
    },
  });
}


  socioNombreActual(): string {
    const n = this.formularioInscripcion.controls.nombre.value ?? '';
    const a = this.formularioInscripcion.controls.apellido.value ?? '';
    return `${n} ${a}`.trim();
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
      this.bumpFormTick();
      return;
    }

    if (this.promoCargandoSig()) {
      this.notificacion.aviso('Cargando promoción del paquete. Intenta de nuevo.');
      return;
    }

    if (!this.validarPaqueteEstudiantilUI()) return;

    this.totalEnModalSig.set(Number(this.totalConPromoSig() ?? 0));
    this.montoPaqueteEnModalSig.set(Number(this.precioPaqueteSig() ?? 0));
    this.montoInscripcionEnModalSig.set(Number(this.costoInscripcionSig() ?? 0));
    this.descuentoEnModalSig.set(Number(this.descuentoTotalSig() ?? 0));

    this.resumenResetKeySig.update((v) => v + 1);

    this.mensajeError = null;
    this.mostrarModalResumen.set(true);

    this.bumpFormTick();
  }

  cerrarModalResumen(): void {
    this.mostrarModalResumen.set(false);

    this.totalEnModalSig.set(0);
    this.montoPaqueteEnModalSig.set(0);
    this.montoInscripcionEnModalSig.set(0);
    this.descuentoEnModalSig.set(0);
  }

  // =========================
  // ✅ Reglas exactas para abrir el modal
  // =========================
  private camposFaltantesParaResumen(): string[] {
    const c = this.formularioInscripcion.controls;
    const f: string[] = [];

    if (c.nombre.invalid) f.push('Nombre');
    if (c.apellido.invalid) f.push('Apellidos');
    if (c.telefono.invalid) f.push('Teléfono (10 dígitos)');
    if (c.fechaNacimiento.invalid) f.push('Fecha de nacimiento');
    if (c.direccion.invalid) f.push('Dirección');
    if (c.genero.invalid) f.push('Sexo');

    const pid = Number(c.paqueteId.value ?? 0);
    if (!pid || pid <= 0 || c.paqueteId.invalid) f.push('Paquete');

    const esEst = this.esPaqueteEstudiantilSig();
    if (esEst) {
      if (!c.credencialEstudianteVigencia.value) f.push('Vigencia credencial estudiante');
    }

    return f;
  }

  // =========================
  // ✅ Validaciones UI: Estudiante
  // =========================
  private syncValidadoresEstudiantePorPaqueteId(paqueteId: number): void {
    const lista = this.listaPaquetesSig();
    const p = (lista ?? []).find((x) => Number(x.idPaquete) === Number(paqueteId)) as any;
    const esEst = Boolean(p?.estudiantil === true);

    const ctrl = this.formularioInscripcion.controls.credencialEstudianteVigencia;

    if (esEst) {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
      ctrl.setValue(null, { emitEvent: false });
    }

    ctrl.updateValueAndValidity({ emitEvent: false });
    this.bumpFormTick();
  }

  private calcularEdadDesdeISO(fechaISO: string, hoy = new Date()): number {
    const parts = String(fechaISO ?? '').split('-').map((x) => Number(x));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;

    const [y, m, d] = parts;
    const birth = new Date(y, (m ?? 1) - 1, d ?? 1);

    let edad = hoy.getFullYear() - birth.getFullYear();
    const mDiff = hoy.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && hoy.getDate() < birth.getDate())) edad--;

    return Math.max(0, edad);
  }

  private validarPaqueteEstudiantilUI(): boolean {
    const esEst = this.esPaqueteEstudiantilSig();
    if (!esEst) return true;

    const fn = this.formularioInscripcion.controls.fechaNacimiento.value;
    if (!fn) {
      this.notificacion.error('Para paquete estudiantil se requiere fecha de nacimiento.');
      return false;
    }

    const edad = this.calcularEdadDesdeISO(fn);
    if (edad > 22) {
      this.notificacion.error(`Paquete estudiantil solo aplica hasta 22 años. Edad actual: ${edad}.`);
      return false;
    }

    const vig = this.formularioInscripcion.controls.credencialEstudianteVigencia.value;
    if (!vig) {
      this.notificacion.error('Para paquete estudiantil se requiere la vigencia de la credencial.');
      return false;
    }

    const hoy = hoyISO();
    if (String(vig) < String(hoy)) {
      this.notificacion.error(`Credencial de estudiante vencida (vigencia: ${vig}).`);
      return false;
    }

    return true;
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
        credencialEstudianteVigencia: socio?.credencialEstudianteVigencia ?? null,
      },
      { emitEvent: false }
    );

    this.huellaDigitalBase64 = socio?.huellaDigital ?? null;

    this.batchEditIndexSig.set(index);
    this.mensajeError = null;
    this.guardarBorradorEnStorage();
    this.notificacion.aviso(`Editando integrante ${index + 1}.`);
    this.bumpFormTick();
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
    this.bumpFormTick();
  }

  guardarEdicionIntegrante(): void {
    if (this.guardandoMembresia) return;

    const idx = this.batchEditIndexSig();
    if (idx === null) return;

    const faltantes = this.camposFaltantesParaResumen();
    if (faltantes.length) {
      this.formularioInscripcion.markAllAsTouched();
      this.mensajeError = 'Completa: ' + faltantes.join(', ') + '.';
      this.bumpFormTick();
      return;
    }

    if (!this.validarPaqueteEstudiantilUI()) return;

    const drafts = [...this.batchDraftsSig()];
    const target = drafts[idx];
    if (!target) return;

    const socioNuevo: any = {
      ...((target.cuerpo?.socio as any) ?? {}),
      nombre: this.formularioInscripcion.controls.nombre.value ?? '',
      apellido: this.formularioInscripcion.controls.apellido.value ?? '',
      direccion: this.formularioInscripcion.controls.direccion.value ?? '',
      telefono: this.formularioInscripcion.controls.telefono.value ?? '',
      email: this.formularioInscripcion.controls.email.value ?? '',
      fechaNacimiento: this.formularioInscripcion.controls.fechaNacimiento.value ?? '',
      genero: this.formularioInscripcion.controls.genero.value ?? 'MASCULINO',
      comentarios: this.formularioInscripcion.controls.comentarios.value ?? '',
      credencialEstudianteVigencia:
        this.formularioInscripcion.controls.credencialEstudianteVigencia.value ?? null,
    };

    if (this.huellaDigitalBase64) {
      socioNuevo.huellaDigital = this.huellaDigitalBase64;
    }

    const socioNombre = this.socioNombreActual();

    drafts[idx] = {
      ...target,
      socioNombre,
      cuerpo: {
        ...target.cuerpo,
        socio: socioNuevo as SocioData,
      },
      pagos: target.pagos,
    };

    this.batchDraftsSig.set(drafts);

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
    this.bumpFormTick();
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
        this.formularioInscripcion.patchValue(draft.form as any, { emitEvent: false });
      }
      this.huellaDigitalBase64 = draft?.huellaDigitalBase64 ?? null;
      this.fotoPreviewUrl = draft?.fotoPreviewUrl ?? null;

      if (Array.isArray(draft?.batchDrafts)) {
        this.batchDraftsSig.set(draft.batchDrafts);
      }

      this.bumpFormTick();
    } catch {
      // noop
    }
  }

  private guardarBorradorEnStorage(): void {
    const formValue = this.formularioInscripcion.getRawValue();
    const draft: InscripcionDraft = {
      form: formValue as unknown as InscripcionFormValue,
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
    this.bumpFormTick();
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
      telefono: '',
      email: null,

      fechaNacimiento: null,
      direccion: '',
      genero: 'MASCULINO',
      comentarios: null,

      paqueteId,
      fechaInicio,
      descuento,
      movimiento,

      credencialEstudianteVigencia: null,
    });

    this.huellaDigitalBase64 = null;
    this.fotoArchivo = null;
    this.fotoPreviewUrl = null;

    this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId }));
    this.store.dispatch(InscripcionActions.setDescuento({ descuento }));
    this.store.dispatch(InscripcionActions.setFechaInicio({ fechaInicio: String(fechaInicio) }));

    this.guardarBorradorEnStorage();
    this.bumpFormTick();
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

    if (!this.validarPaqueteEstudiantilUI()) return;

    const totalUI = Number(this.totalEnModalSig() || this.totalConPromoSig() || 0);

    let pagos: PagoData[] = Array.isArray(evento)
      ? evento
      : [{ tipoPago: evento, monto: totalUI }];

    const sumaPagos = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(totalUI - sumaPagos) > 0.01) {
      if (Array.isArray(pagos) && pagos.length === 1) {
        pagos = [{ ...pagos[0], monto: totalUI }];
      } else {
        this.notificacion.aviso(
          `La suma de pagos (${sumaPagos.toFixed(2)}) no coincide con el total (${totalUI.toFixed(2)}).`
        );
        return;
      }
    }

    const fechaInicio = this.fechaInicioSelSig() ?? hoyISO();

    const socioPayload: any = {
      nombre: this.formularioInscripcion.controls.nombre.value!,
      apellido: this.formularioInscripcion.controls.apellido.value!,
      direccion: this.formularioInscripcion.controls.direccion.value!,
      telefono: this.formularioInscripcion.controls.telefono.value!,
      email: this.formularioInscripcion.controls.email.value ?? '',
      fechaNacimiento: this.formularioInscripcion.controls.fechaNacimiento.value ?? '',
      genero: this.formularioInscripcion.controls.genero.value!,
      comentarios: this.formularioInscripcion.controls.comentarios.value ?? '',
      credencialEstudianteVigencia:
        this.formularioInscripcion.controls.credencialEstudianteVigencia.value ?? null,
    };

    if (this.huellaDigitalBase64) {
      socioPayload.huellaDigital = this.huellaDigitalBase64;
    }

    const cuerpo: MembresiaPayload = {
      socio: socioPayload as SocioData,
      paquete: { idPaquete: paquete.idPaquete },
      fechaInicio,
      movimiento: this.formularioInscripcion.controls.movimiento.value!,
      pagos,
      descuento: this.descuentoTotalSig() ?? 0,
    };

    const socioNombre = this.socioNombreActual();

    const requerido = this.batchRequeridoSig();
    const esBatch = requerido > 1;

    if (!esBatch) {
      this.guardandoMembresia = true;

      of(void 0)
        .pipe(
          switchMap(() => this.membresiaSrv.guardar(cuerpo as unknown as MembresiaData)),
          finalize(() => (this.guardandoMembresia = false)),
          catchError((err: any) => {
            this.notificacion.error(this.extraerMensajeError(err));
            return of(null);
          })
        )
        .subscribe((resp: any) => {
          if (!resp) return;

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
            descuento: Number(this.descuentoTotalSig() ?? 0),
            costoInscripcion: Number(this.costoInscripcionSig() ?? 0),
            pagos: pagosDet,
            referencia: resp?.referencia,
          });

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
            credencialEstudianteVigencia: null,
            nombre: '',
            apellido: '',
            direccion: '',
          });

          this.paqueteBusquedaSig.set('');
          this.store.dispatch(InscripcionActions.reset());
          this.cargarPaquetes();

          this.notificacion.exito('Membresía guardada con éxito.');
          this.bumpFormTick();
        });

      return;
    }

    const drafts = this.batchDraftsSig();
    const capturados = drafts.length;
    const esUltimo = capturados === requerido - 1;

    if (!esUltimo) {
      const nuevos = [...drafts, { socioNombre, cuerpo, pagos }];
      this.batchDraftsSig.set(nuevos);

      this.lockPaqueteControl(true);
      this.guardarBorradorEnStorage();

      this.cerrarModalResumen();
      this.notificacion.exito(`Integrante ${nuevos.length}/${requerido} capturado. Continúa con el siguiente.`);
      this.limpiarParaSiguienteIntegrante();
      this.bumpFormTick();
      return;
    }

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
          credencialEstudianteVigencia: null,
          nombre: '',
          apellido: '',
          direccion: '',
        });

        this.paqueteBusquedaSig.set('');
        this.store.dispatch(InscripcionActions.reset());
        this.cargarPaquetes();

        this.notificacion.exito(`Lote guardado con éxito (${requerido} membresías).`);
        this.bumpFormTick();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoMembresia = false;

        this.lockPaqueteControl(true);
        this.guardarBorradorEnStorage();

        this.notificacion.error(this.extraerMensajeError(err));
        this.bumpFormTick();
      },
    });
  }

  // =========================
  // ✅ Promociones
  // =========================
  private round2(n: number): number {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
  }

  private toISODate(value: any): string | null {
    const s = String(value ?? '').trim();
    if (!s) return null;
    return s.includes('T') ? s.split('T')[0] : s;
  }

  private promoVigenteHoy(promo: any, hoy: string): boolean {
    const ini = this.toISODate(promo?.fechaInicio);
    const fin = this.toISODate(promo?.fechaFin);

    if (ini && String(hoy) < String(ini)) return false;
    if (fin && String(hoy) > String(fin)) return false;
    return true;
  }

  private scorePromo(promo: any, precioPaquete: number, costoInscripcion: number): number {
    const tipo = String(promo?.tipo ?? '').toUpperCase();

    let score = 0;
    if (promo?.sinCostoInscripcion === true) score += Math.max(0, Number(costoInscripcion) || 0);

    if (tipo === 'DESCUENTO_PORCENTAJE' || tipo === 'PORCENTAJE') {
      const pct = Number(promo?.descuentoPorcentaje ?? 0);
      if (pct > 0) score += (Math.max(0, Number(precioPaquete) || 0) * pct) / 100;
    } else if (tipo === 'DESCUENTO_MONTO' || tipo === 'MONTO') {
      score += Math.max(0, Number(promo?.descuentoMonto ?? 0) || 0);
    }

    const mg = Number(promo?.mesesGratis ?? 0) || 0;
    if (mg > 0) score += mg * 0.0001;

    return Number.isFinite(score) ? score : 0;
  }

  private seleccionarMejorPromocion(
    lista: PromocionUI[],
    precioPaquete: number,
    costoInscripcion: number
  ): PromocionUI | null {
    const hoy = hoyISO();
    const vigentes = (lista ?? [])
      .filter((p) => p && (p as any)?.activo !== false)
      .filter((p) => this.promoVigenteHoy(p as any, hoy));

    if (!vigentes.length) return null;

    const ordenadas = [...vigentes].sort(
      (a, b) =>
        this.scorePromo(b as any, precioPaquete, costoInscripcion) -
        this.scorePromo(a as any, precioPaquete, costoInscripcion)
    );

    return ordenadas[0] ?? null;
  }

  private cargarPromocionesPorPaquete(idPaquete: number): void {
    const id = Number(idPaquete ?? 0);

    if (!id || id <= 0) {
      this.promocionesVigentesSig.set([]);
      this.promoErrorSig.set(null);
      return;
    }

    this.promoCargandoSig.set(true);
    this.promoErrorSig.set(null);

    this.paqueteSrv
      .buscarPromocionesVigentes(id)
      .pipe(
        finalize(() => {
          this.promoCargandoSig.set(false);
          this.bumpFormTick();
        }),
        catchError((err: any) => {
          this.promoErrorSig.set(this.extraerMensajeError(err));
          return of([] as PromocionUI[]);
        })
      )
      .subscribe((lista: any) => {
        this.promocionesVigentesSig.set(Array.isArray(lista) ? (lista as PromocionUI[]) : []);
        this.bumpFormTick();
      });
  }

  private extraerMensajeError(err: any): string {
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
      this.bumpFormTick();
    };
    reader.readAsDataURL(file);
  }

  quitarFoto(): void {
    this.fotoArchivo = null;
    this.fotoPreviewUrl = null;
    this.guardarBorradorEnStorage();
    this.bumpFormTick();
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

    this.bumpFormTick();
  }

  // ✅ ID robusto (soporta idPaquete | paqueteId | id | id_paquete)
  private getPaqueteId(p: any): number {
    const raw =
      p?.idPaquete ??
      p?.paqueteId ??
      p?.id ??
      p?.id_paquete ??
      p?.idPaqueteFk ??
      0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ✅ normaliza objeto para que SIEMPRE tenga idPaquete + números
  private normalizePaquete(p: any): PaqueteUI {
    const id = this.getPaqueteId(p);
    return {
      ...(p ?? {}),
      idPaquete: id,
      precio: this.toNumber(p?.precio),
      costoInscripcion: this.toNumber(p?.costoInscripcion),
    } as PaqueteUI;
  }

  /** ✅ Aplica selección de paquete sin depender de valueChanges */
  private aplicarSeleccionPaquete(idPaquete: number, picked?: PaqueteUI): void {
    const id = Number(idPaquete ?? 0);
    if (!id || id <= 0) return;

    // 1) set form SIN disparar valueChanges
    this.formularioInscripcion.controls.paqueteId.setValue(id, { emitEvent: false });

    // 2) set store
    this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId: id }));

    // 3) fechaInicio default (y store)
    if (!this.formularioInscripcion.controls.fechaInicio.value) {
      const hoy = hoyISO();
      this.formularioInscripcion.controls.fechaInicio.setValue(hoy, { emitEvent: false });
      this.store.dispatch(InscripcionActions.setFechaInicio({ fechaInicio: hoy }));
    }

    // 4) estudiante + promos
    this.syncValidadoresEstudiantePorPaqueteId(id);
    this.cargarPromocionesPorPaquete(id);

    // 5) etiqueta input
    const master = (this.listaPaquetesSig() ?? []).find((x) => this.getPaqueteId(x) === id);
    const show = master ?? picked;
    if (show) this.paqueteBusquedaSig.set(this.paqueteLabel(show));

    // ✅ clave para que el botón reaccione aunque sea zoneless
    this.bumpFormTick();
  }
}
