// src/app/pages/inscripcion/inscripcion.ts

import {
  Component,
  OnInit,
  signal,
  inject,
  DestroyRef,
  computed,
  effect,
  Injector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
} from 'rxjs';

import { ResumenCompra } from '../../../../shared/ui/resumen-compra/resumen-compra';
import { HuellaModal } from '../../../../shared/huella/huella-modal/huella-modal';

import { PaqueteService } from '../../../administracion/data/paquete-service';
import { MembresiaService } from '../../../../shared/data/membresia-service';
import { NotificacionService } from '../../../../core/layout/notificacion-service';
import { GimnasioService } from '../../../../shared/data/gimnasio-service';
import { TicketService, VentaContexto } from '../../../../shared/ticket/ticket-service';
import { EntrenadorService } from '../../../asesorias/data/entrenador-service';

import { PaqueteData } from '../../../../shared/models/paquete-data';
import { SocioData } from '../../../../shared/models/socio-data';
import { MembresiaData, PagoData } from '../../../../shared/models/membresia-data';
import { GimnasioData } from '../../../../shared/models/gimnasio-data';
import { EntrenadorData } from '../../../../shared/models/entrenador-data';

import { TipoMovimiento } from '../../../../shared/util/enums/tipo-movimiento';
import { TipoPago } from '../../../../shared/util/enums/tipo-pago';
import { TiempoPlanLabelPipe } from '../../../../shared/util/tiempo-plan-label';
import { hoyISO } from '../../../../shared/util/fechas-precios';
import { crearContextoTicket, obtenerNombreCajero } from '../../../../shared/util/ticket-contexto';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../../environments/environment';

import { InscripcionStore } from '../../data/inscripcion-store';
import { PromocionData } from '../../../../shared/models/promocion-data';
import {
  elegirMejorPromocion,
  calcularTotalMembresia,
  calcularFechaFinConBeneficio,
  validarPaqueteEstudiantil,
  calcularEdadDesdeISO,
} from '../../data/calculo-membresia';

type MembresiaPayload = Omit<MembresiaData, 'paquete' | 'total' | 'fechaFin'> & {
  paquete: { idPaquete: number };
  idEntrenadorRA?: number;
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
  descuento: number; // ✅ MONTO (no %)
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
  paqueteTexto?: string | null; // ✅ (opcional) para rehidratar el input rápido
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
  private injector = inject(Injector);
  private notificacion = inject(NotificacionService);

  constructor(
    private paqueteSrv: PaqueteService,
    private membresiaSrv: MembresiaService,
  ) {}

  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt = inject(JwtHelperService);
  private store = inject(InscripcionStore);
  private entrenadorSrv = inject(EntrenadorService);

  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // =========================
  // ✅ Entrenador RA
  // =========================
  entrenadoresRASig = signal<EntrenadorData[]>([]);
  cargandoEntrenadoresSig = signal(false);
  entrenadorRAIdSig = signal<number | null>(null);

  esPaqueteRASig = computed(() => Boolean((this.paqueteActualSig() as any)?.esRA === true));

  // =====================================================
  // ✅ tick signal para forzar recomputes en apps zoneless
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

  private readonly esElectronApp = this.detectarElectron();

  // ✅ Usaremos el pipe también en TS para que "UNA_SEMANA" -> "1 semana"
  private tiempoPlanPipe = new TiempoPlanLabelPipe();

  paquetesSugeridosSig = computed<PaqueteUI[]>(() => {
    const qRaw = (this.paqueteBusquedaSig() ?? '').trim();
    const lista = this.listaPaquetesSig() ?? [];
    const remote = this.paquetesResultadosSig() ?? [];

    // Sin texto: muestra top
    if (!qRaw) return lista.slice(0, 12);

    // ✅ Filtrado local robusto (incluye tiempo/modalidad/estudiantil)
    const localMatches = lista.filter((p) => this.matchPaquete(p, qRaw)).slice(0, 30);

    // ✅ Merge con resultados remotos (por si tu endpoint trae algo extra)
    const remoteMatches = remote
      .map((x) => this.normalizePaquete(x))
      .filter((p) => this.matchPaquete(p, qRaw))
      .slice(0, 30);

    return this.mergeUniquePaquetes([...localMatches, ...remoteMatches]).slice(0, 30);
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

  // ✅ Descuento como signal (fuente única para cálculos UI)
  descuentoUiSig = signal<number>(0);

  private syncDescuentoUiFromForm(): void {
    const v = Number(this.formularioInscripcion.controls.descuento.value ?? 0);
    this.descuentoUiSig.set(Number.isFinite(v) ? Math.max(0, v) : 0);
  }

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

  // =========================
  // Store signals (solo lo necesario)
  // =========================
  paqueteActualSig = this.store.paqueteActual;
  paqueteIdSelSig = this.store.paqueteId;

  descuentoManualSig = computed(() => this.descuentoUiSig());

  paqueteIdFormSig = computed(() => {
    this.formTickSig();
    return Number(this.formularioInscripcion.controls.paqueteId.value ?? 0);
  });

  precioPaqueteUiSig = computed(() => {
    const p: any = this.paqueteActualSig();
    const precio = Number(p?.precio ?? 0);
    return Number.isFinite(precio) ? Math.max(0, precio) : 0;
  });

  costoInscripcionUiSig = computed(() => {
    const p: any = this.paqueteActualSig();
    const c = Number(p?.costoInscripcion ?? 0);
    return Number.isFinite(c) ? Math.max(0, c) : 0;
  });

  // =========================
  // ✅ Promociones (por paquete)
  // =========================
  promoCargandoSig = signal(false);
  promocionesVigentesSig = signal<PromocionUI[]>([]);
  promoErrorSig = signal<string | null>(null);

  // ✅ Decisión de negocio #1 (Fase 5b): selección por `prioridad` (empate:
  // mayor idPromocion), no por valor monetario — vía calculo-membresia.ts.
  promocionAplicadaSig = computed<PromocionUI | null>(() => {
    const lista = this.promocionesVigentesSig();
    return elegirMejorPromocion(lista as unknown as PromocionData[], {
      esRenovacion: false,
      hoyISO: hoyISO(),
    }) as PromocionUI | null;
  });

  // ✅ Única fuente de verdad para descuento/total — lectura 100% en vivo
  // (decisión #8: sin snapshot congelado, el modal y el confirm leen de acá).
  resultadoTotalMembresiaSig = computed(() =>
    calcularTotalMembresia({
      precioPaquete: this.precioPaqueteUiSig(),
      costoInscripcion: this.costoInscripcionUiSig(),
      descuentoManual: this.descuentoManualSig(),
      promo: this.promocionAplicadaSig() as unknown as PromocionData | null,
    }),
  );

  promoInscripcionGratisSig = computed(
    () => this.resultadoTotalMembresiaSig().beneficioPromo.exentoCostoInscripcion,
  );

  promoMesesGratisSig = computed(() => this.resultadoTotalMembresiaSig().beneficioPromo.mesesGratis);

  promoDescuentoMontoSig = computed(
    () => this.resultadoTotalMembresiaSig().beneficioPromo.descuentoMonto,
  );

  // ✅ descuento TOTAL que se envía al backend (manual + promo + inscripción
  // gratis, esta última mostrada como parte del descuento para que el
  // desglose "Inscripción (monto lleno) - Descuento" siga cuadrando).
  descuentoTotalSig = computed(() => {
    const r = this.resultadoTotalMembresiaSig();
    const insc = Math.max(0, Number(this.costoInscripcionUiSig() ?? 0));
    const inscGratis = r.beneficioPromo.exentoCostoInscripcion ? insc : 0;
    return this.round2(r.descuentoTotal + inscGratis);
  });

  totalConPromoSig = computed(() => this.resultadoTotalMembresiaSig().total);

  totalSinPromoSig = computed(
    () =>
      calcularTotalMembresia({
        precioPaquete: this.precioPaqueteUiSig(),
        costoInscripcion: this.costoInscripcionUiSig(),
        descuentoManual: this.descuentoManualSig(),
        promo: null,
      }).total,
  );

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

  // ✅ Decisión de negocio #3 + corrección #5 (Fase 5b): la fecha de fin de
  // vigencia real considera los meses gratis de la promo elegida. El store
  // (Fase 5a, no se toca) solo calcula la fecha de fin del plan; esta capa
  // extiende esa fecha por encima cuando aplica. Se usa en vez de
  // `fechaPagoVistaSig` en todo lugar donde la UI muestra/usa la vigencia
  // final real.
  fechaFinConBeneficioSig = computed(() =>
    calcularFechaFinConBeneficio(
      String(this.store.fechaInicio() ?? ''),
      (this.paqueteActualSig() as any)?.tiempo ?? null,
      this.resultadoTotalMembresiaSig().beneficioPromo.mesesGratis,
    ),
  );

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
  // ✅ Señal reactiva para habilitar botón
  // =====================================================
  puedeAbrirResumenSig = computed(() => {
    this.formTickSig();

    const faltantes = this.camposFaltantesParaResumen();
    return faltantes.length === 0 && !this.promoCargandoSig() && !this.guardandoMembresia;
  });

  resumenResetKeySig = signal(0);

  ngOnInit(): void {
    this.cargarContextoDesdeToken();
    this.cargarBorradorDesdeStorage(); // ✅ rehidrata FORM + STORE
    this.cargarPaquetes();
    this.cargarEntrenadoresRA();

    // ✅ si el store tiene paqueteId, sincronízalo al FORM
    effect(
      () => {
        this.formTickSig();

        const pidStore = Number(this.paqueteIdSelSig() ?? 0);
        const pidForm = Number(this.formularioInscripcion.controls.paqueteId.value ?? 0);

        if (pidStore > 0 && pidForm !== pidStore) {
          this.formularioInscripcion.controls.paqueteId.setValue(pidStore, {
            emitEvent: false,
          });
          this.formularioInscripcion.controls.paqueteId.updateValueAndValidity({
            emitEvent: false,
          });

          const lista = this.listaPaquetesSig();
          const sel = (lista ?? []).find((p) => Number(p.idPaquete) === pidStore);
          if (sel) this.paqueteBusquedaSig.set(this.paqueteLabel(sel));

          this.syncValidadoresEstudiantePorPaqueteId(pidStore);
          this.cargarPromocionesPorPaquete(pidStore);

          // ✅ IMPORTANTÍSIMO: como fue emitEvent:false, guardamos borrador aquí
          this.guardarBorradorEnStorage();

          this.bumpFormTick();
        }
      },
      { injector: this.injector },
    );

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
            finalize(() => this.paqueteBuscandoSig.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => this.paquetesResultadosSig.set(lista ?? []));

    // ✅ mantener input mostrando el paquete seleccionado (al cerrar dropdown)
    effect(
      () => {
        const dropdownOpen = this.paqueteDropdownAbiertoSig();
        if (dropdownOpen) return;

        const id =
          Number(this.formularioInscripcion.controls.paqueteId.value ?? 0) ||
          Number(this.paqueteIdSelSig() ?? 0);

        const lista = this.listaPaquetesSig();
        const sel = (lista ?? []).find((p) => Number(p.idPaquete) === id);

        if (sel) {
          this.paqueteBusquedaSig.set(this.paqueteLabel(sel));
          // ✅ persistimos también el texto (por UX)
          this.guardarBorradorEnStorage();
        }
      },
      { injector: this.injector },
    );

    // paqueteId (si cambia por restore u otra UI)
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

        const pid = Number(id ?? 0);

        // ✅ store
        this.store.establecerPaqueteId(pid);

        if (!this.formularioInscripcion.controls.fechaInicio.value) {
          this.formularioInscripcion.controls.fechaInicio.setValue(hoyISO(), {
            emitEvent: false,
          });
        }

        this.syncValidadoresEstudiantePorPaqueteId(pid);
        this.cargarPromocionesPorPaquete(pid);

        if (!this.paqueteDropdownAbiertoSig()) {
          const lista = this.listaPaquetesSig();
          const sel = (lista ?? []).find((p) => Number(p.idPaquete) === pid);
          if (sel) this.paqueteBusquedaSig.set(this.paqueteLabel(sel));
        }

        // ✅ persistencia
        this.guardarBorradorEnStorage();

        this.bumpFormTick();
      });

    // ✅ fechaInicio → store + persist
    this.formularioInscripcion.controls.fechaInicio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const iso = String(v ?? hoyISO());
        this.store.establecerFechaInicio(iso);
        this.guardarBorradorEnStorage();
        this.bumpFormTick();
      });

    // valueChanges/statusChanges → tick + persist
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
      Number(this.formularioInscripcion.controls.paqueteId.value ?? 0),
    );

    this.cargarPromocionesPorPaquete(
      Number(this.formularioInscripcion.controls.paqueteId.value ?? 0),
    );

    this.bumpFormTick();
  }

  // =========================
  // ✅ Buscador Paquetes - helpers
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
        { map: new Map<number, boolean>(), arr: [] as PaqueteUI[] },
      ).arr;

    this.listaPaquetesSig.set(nueva);
    this.store.establecerListaPaquetes(nueva as any);

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

    // ✅ persistencia del texto actual
    this.guardarBorradorEnStorage();
  }

  onPaqueteBusquedaChange(v: string): void {
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    this.paqueteBusquedaSig.set(v);
    this.paqueteDropdownAbiertoSig.set(true);
    this.paqueteBuscar$.next(v);

    // ✅ persistencia (por si cambias pantalla)
    this.guardarBorradorEnStorage();
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

    // ✅ persistencia inmediata (emitEvent:false)
    this.guardarBorradorEnStorage();

    this.bumpFormTick();
  }

  limpiarPaqueteSeleccionado(evt?: Event): void {
    evt?.stopPropagation();
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    this.formularioInscripcion.controls.paqueteId.setValue(0, { emitEvent: false });
    this.formularioInscripcion.controls.paqueteId.updateValueAndValidity({ emitEvent: false });
    this.store.establecerPaqueteId(0);

    this.paqueteBusquedaSig.set('');
    this.paquetesResultadosSig.set([]);
    this.paqueteDropdownAbiertoSig.set(false);

    this.promocionesVigentesSig.set([]);
    this.promoErrorSig.set(null);
    this.entrenadorRAIdSig.set(null);

    // ✅ persistencia inmediata
    this.guardarBorradorEnStorage();

    this.bumpFormTick();
  }

  // =========================
  // Lock/Unlock paqueteId
  // =========================
  private lockPaqueteControl(locked: boolean): void {
    this.paqueteBloqueadoSig.set(locked);
    if (locked) this.cerrarDropdownPaquetes();
    this.guardarBorradorEnStorage();
  }

  private cargarPaquetes(): void {
    this.cargandoPaquetes = true;

    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        const activos = (lista ?? [])
          .map((x) => this.normalizePaquete(x))
          .filter((p) => p?.activo !== false && this.getPaqueteId(p) > 0) as PaqueteUI[];

        this.listaPaquetesSig.set(activos);
        this.store.establecerListaPaquetes(activos as any);

        // ✅ preferir form, luego store
        const idForm = Number(this.formularioInscripcion.controls.paqueteId.value ?? 0);
        const idStore = Number(this.paqueteIdSelSig() ?? 0);
        const idPreferido = idForm > 0 ? idForm : idStore > 0 ? idStore : 0;

        const existe = activos.some((p) => Number(p.idPaquete) === Number(idPreferido));
        const idFinal = existe ? idPreferido : 0;

        if (idFinal > 0) {
          const sel = activos.find((p) => Number(p.idPaquete) === Number(idFinal));
          this.aplicarSeleccionPaquete(idFinal, sel);
        } else {
          // no resetees “por resetear” si hay borrador con texto (mejora UX)
          const draftTexto = (this.paqueteBusquedaSig() ?? '').trim();
          this.formularioInscripcion.controls.paqueteId.setValue(0, { emitEvent: false });
          this.formularioInscripcion.controls.paqueteId.updateValueAndValidity({
            emitEvent: false,
          });
          this.store.establecerPaqueteId(0);

          if (!draftTexto) this.paqueteBusquedaSig.set('');

          this.promocionesVigentesSig.set([]);
          this.promoErrorSig.set(null);
          this.syncValidadoresEstudiantePorPaqueteId(0);
        }

        this.cargandoPaquetes = false;

        // ✅ persistencia (por si navegaste y regresaste)
        this.guardarBorradorEnStorage();

        this.bumpFormTick();
      },
      error: () => {
        this.cargandoPaquetes = false;
        this.mensajeError = 'No se pudieron cargar los paquetes.';
        this.bumpFormTick();
      },
    });
  }

  private cargarEntrenadoresRA(): void {
    this.cargandoEntrenadoresSig.set(true);
    this.entrenadorSrv.buscarTodos().subscribe({
      next: (lista) => {
        const seen = new Set<number>();
        const activos = (lista ?? [])
          .filter((e: any) => e?.activo !== false)
          .map(
            (e: any) =>
              ({
                idEntrenador: Number(e?.idEntrenador ?? e?.id ?? 0),
                nombre: String(e?.nombre ?? ''),
                apellido: String(e?.apellido ?? ''),
                activo: e?.activo !== false,
                gimnasio: e?.gimnasio,
              }) as EntrenadorData,
          )
          .filter((e) => {
            if (!e.idEntrenador) return false;
            if (seen.has(e.idEntrenador)) return false;
            seen.add(e.idEntrenador);
            return true;
          });
        this.entrenadoresRASig.set(activos);
        this.cargandoEntrenadoresSig.set(false);
      },
      error: () => this.cargandoEntrenadoresSig.set(false),
    });
  }

  onEntrenadorRAChange(value: string): void {
    const id = Number(value);
    this.entrenadorRAIdSig.set(id > 0 ? id : null);
  }

  socioNombreActual(): string {
    const n = this.formularioInscripcion.controls.nombre.value ?? '';
    const a = this.formularioInscripcion.controls.apellido.value ?? '';
    return `${n} ${a}`.trim();
  }

  abrirModalResumen(): void {
    if (this.guardandoMembresia) return;

    if (this.editandoIntegranteSig()) {
      this.notificacion.aviso(
        'Estás editando un integrante capturado. Guarda o cancela la edición.',
      );
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

    this.resumenResetKeySig.update((v) => v + 1);

    this.mensajeError = null;
    this.mostrarModalResumen.set(true);

    this.bumpFormTick();
  }

  cerrarModalResumen(): void {
    this.mostrarModalResumen.set(false);
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

    // ✅ paqueteId puede venir del store aunque el form se haya quedado atrás
    const pidForm = Number(c.paqueteId.value ?? 0);
    const pidStore = Number(this.paqueteIdSelSig() ?? 0);
    const pid = pidForm > 0 ? pidForm : pidStore;

    if (!pid || pid <= 0 || c.paqueteId.invalid) f.push('Paquete');

    const esEst = this.esPaqueteEstudiantilSig();
    if (esEst) {
      if (!c.credencialEstudianteVigencia.value) f.push('Vigencia credencial estudiante');
    }

    if (this.esPaqueteRASig() && !this.entrenadorRAIdSig()) {
      f.push('Entrenador RA');
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

  // ✅ Decisión de negocio #4/#5 (Fase 5b): regla pura movida a
  // calculo-membresia.ts (`validarPaqueteEstudiantil`/`calcularEdadDesdeISO`)
  // — este screen ya solo usa la bandera explícita `paquete.estudiantil`
  // (esPaqueteEstudiantilSig), sin heurísticas, así que la regla en sí no
  // cambia acá. La función es pura (sin notificación propia); este método
  // decide cómo mostrar el `motivo`.
  private validarPaqueteEstudiantilUI(): boolean {
    const resultado = validarPaqueteEstudiantil({
      esPaqueteEstudiantil: this.esPaqueteEstudiantilSig(),
      fechaNacimientoISO: this.formularioInscripcion.controls.fechaNacimiento.value ?? null,
      credencialVigenciaISO:
        this.formularioInscripcion.controls.credencialEstudianteVigencia.value ?? null,
      hoyISO: hoyISO(),
      calcularEdad: calcularEdadDesdeISO,
    });

    if (!resultado.valido) {
      this.notificacion.error(resultado.motivo ?? 'Paquete estudiantil inválido.');
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
      { emitEvent: false },
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
      const raw = this.leerBorradorRaw();
      if (!raw) return;

      const draft = JSON.parse(raw) as InscripcionDraft;

      if (draft?.form) {
        this.formularioInscripcion.patchValue(draft.form as any, { emitEvent: false });
        this.syncDescuentoUiFromForm();

        // ✅ REHIDRATAR STORE (CLAVE para que “sí salga” el paquete y fechaPagoVista)
        const pid = Number(draft.form.paqueteId ?? 0);
        const fi = String(draft.form.fechaInicio ?? hoyISO());
        const desc = Number(draft.form.descuento ?? 0);

        this.store.establecerPaqueteId(pid);
        this.store.establecerFechaInicio(fi);
        this.store.establecerDescuento(desc);

        this.descuentoUiSig.set(this.normalizarMonto(desc));
      }

      this.huellaDigitalBase64 = draft?.huellaDigitalBase64 ?? null;
      this.fotoPreviewUrl = draft?.fotoPreviewUrl ?? null;

      if (draft?.paqueteTexto) {
        this.paqueteBusquedaSig.set(String(draft.paqueteTexto ?? ''));
      }

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
      paqueteTexto: (this.paqueteBusquedaSig() ?? '').trim() || null,
    };

    try {
      this.guardarBorradorRaw(JSON.stringify(draft));
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

    this.store.establecerPaqueteId(paqueteId);
    this.store.establecerFechaInicio(String(fechaInicio));
    this.store.establecerDescuento(Number(descuento));

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

    // ✅ Decisión de negocio #8 (Fase 5b): lectura 100% en vivo, sin
    // snapshot congelado — lo que se mostró en el modal de resumen y lo que
    // se envía al backend vienen de la MISMA fuente (resultadoTotalMembresiaSig).
    const totalUI = this.totalConPromoSig();
    const descuentoTotalActual = this.descuentoTotalSig();

    let pagos: PagoData[] = Array.isArray(evento) ? evento : [{ tipoPago: evento, monto: totalUI }];

    const sumaPagos = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(totalUI - sumaPagos) > 0.01) {
      if (Array.isArray(pagos) && pagos.length === 1) {
        pagos = [{ ...pagos[0], monto: totalUI }];
      } else {
        this.notificacion.aviso(
          `La suma de pagos (${sumaPagos.toFixed(2)}) no coincide con el total (${totalUI.toFixed(2)}).`,
        );
        return;
      }
    }

    const fechaInicio = this.formularioInscripcion.controls.fechaInicio.value ?? hoyISO();

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

    const entrenadorRAId = this.esPaqueteRASig() ? this.entrenadorRAIdSig() : null;
    const entrenadorRAObj = entrenadorRAId
      ? this.entrenadoresRASig().find((e) => e.idEntrenador === entrenadorRAId)
      : null;
    const entrenadorRANombre = entrenadorRAObj
      ? `${entrenadorRAObj.nombre} ${entrenadorRAObj.apellido}`.trim()
      : undefined;

    const cuerpo: MembresiaPayload = {
      socio: socioPayload as SocioData,
      paquete: { idPaquete: paquete.idPaquete },
      fechaInicio,
      movimiento: this.formularioInscripcion.controls.movimiento.value!,
      pagos,
      descuento: descuentoTotalActual, // ✅ descuento TOTAL (manual+promo+insc gratis)
      ...(entrenadorRAId ? { idEntrenadorRA: entrenadorRAId } : {}),
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
          }),
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
            descuento: Number(descuentoTotalActual ?? 0),
            costoInscripcion: Number((paquete as any)?.costoInscripcion ?? 0),
            pagos: pagosDet,
            referencia: resp?.referencia,
            entrenadorNombre: entrenadorRANombre,
          });

          this.cerrarModalResumen();

          this.huellaDigitalBase64 = null;
          this.fotoArchivo = null;
          this.fotoPreviewUrl = null;
          this.entrenadorRAIdSig.set(null);

          this.limpiarBorradorStorage();

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
          this.store.reiniciar();
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
      this.notificacion.exito(
        `Integrante ${nuevos.length}/${requerido} capturado. Continúa con el siguiente.`,
      );
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
            precioPaquete: Number(resp?.paquete?.precio ?? this.precioPaqueteUiSig() ?? 0),
            descuento: Number(resp?.descuento ?? d.cuerpo?.descuento ?? 0),
            costoInscripcion: Number(
              resp?.paquete?.costoInscripcion ?? this.costoInscripcionUiSig() ?? 0,
            ),
            pagos: pagosDet,
            referencia: resp?.referencia,
            entrenadorNombre: entrenadorRANombre,
          });
        }

        this.guardandoMembresia = false;
        this.cerrarModalResumen();

        this.batchDraftsSig.set([]);
        this.lockPaqueteControl(false);

        this.huellaDigitalBase64 = null;
        this.fotoArchivo = null;
        this.fotoPreviewUrl = null;
        this.entrenadorRAIdSig.set(null);

        this.limpiarBorradorStorage();

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
        this.store.reiniciar();
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
        }),
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
      this.cajero = obtenerNombreCajero(decoded?.preferred_username ?? decoded?.sub);

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
        : 'Huella registrada.',
    );

    this.bumpFormTick();
  }

  // ✅ ID robusto
  private getPaqueteId(p: any): number {
    const raw = p?.idPaquete ?? p?.paqueteId ?? p?.id ?? p?.id_paquete ?? p?.idPaqueteFk ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

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
    this.formularioInscripcion.controls.paqueteId.updateValueAndValidity({ emitEvent: false });

    // 2) set store
    this.store.establecerPaqueteId(id);

    // 3) fechaInicio default
    if (!this.formularioInscripcion.controls.fechaInicio.value) {
      const hoy = hoyISO();
      this.formularioInscripcion.controls.fechaInicio.setValue(hoy, { emitEvent: false });
      this.store.establecerFechaInicio(hoy);
    }

    // 4) estudiante + promos
    this.syncValidadoresEstudiantePorPaqueteId(id);
    this.cargarPromocionesPorPaquete(id);

    // 5) etiqueta input
    const master = (this.listaPaquetesSig() ?? []).find((x) => this.getPaqueteId(x) === id);
    const show = master ?? picked;
    if (show) this.paqueteBusquedaSig.set(this.paqueteLabel(show));

    // ✅ CLAVE: persistir porque NO hay valueChanges aquí
    this.guardarBorradorEnStorage();

    this.bumpFormTick();
  }

  private normalizarMonto(raw: any): number {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  onDescuentoInput(raw: any): void {
    const val = this.normalizarMonto(raw);

    // 🔥 Fuerza el FormControl a tener el valor en caliente
    this.formularioInscripcion.controls.descuento.setValue(val, { emitEvent: false });
    this.formularioInscripcion.controls.descuento.updateValueAndValidity({ emitEvent: false });

    // Señal (UI) + store + draft + tick
    this.descuentoUiSig.set(val);
    this.store.establecerDescuento(val);
    this.guardarBorradorEnStorage();
    this.bumpFormTick();
  }
  private normText(v: any): string {
    const s = String(v ?? '')
      .toLowerCase()
      .trim();
    // quitar acentos (si el runtime lo soporta)
    try {
      return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return s.replace(/\s+/g, ' ').trim();
    }
  }

  private paqueteSearchText(p: PaqueteUI): string {
    const nombre = String(p?.nombre ?? '');

    // tiempo puede venir como: p.tiempo, p.tiempoPlan, etc.
    const tiempoRaw = (p as any)?.tiempo ?? (p as any)?.tiempoPlan ?? '';
    const tiempo = this.tiempoPlanPipe.transform(tiempoRaw);

    const modalidad = this.modalidadTexto((p as any)?.modalidad);
    const est = (p as any)?.estudiantil ? 'estudiantil estudiante' : '';

    // ✅ Texto completo que sí contiene "1 semana" aunque no esté en el nombre
    return this.normText(`${nombre} ${tiempo} ${modalidad} ${est}`);
  }

  private matchPaquete(p: PaqueteUI, qRaw: string): boolean {
    const haystack = this.paqueteSearchText(p);
    const tokens = this.normText(qRaw).split(' ').filter(Boolean);

    // ✅ Match por tokens: "1 seman" -> ["1","seman"] y matchea "1 semana"
    return tokens.every((t) => haystack.includes(t));
  }

  private mergeUniquePaquetes(items: PaqueteUI[]): PaqueteUI[] {
    const seen = new Set<number>();
    const out: PaqueteUI[] = [];

    for (const p of items) {
      const id = this.getPaqueteId(p);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(p);
    }
    return out;
  }

  onVigenciaEstudianteInput(raw: any): void {
    const v = String(raw ?? '').trim();
    const val: string | null = v ? v : null;

    // fuerza el valor en el form control INMEDIATO
    this.formularioInscripcion.controls.credencialEstudianteVigencia.setValue(val, {
      emitEvent: false,
    });
    this.formularioInscripcion.controls.credencialEstudianteVigencia.updateValueAndValidity({
      emitEvent: false,
    });

    // persist + recompute signals
    this.guardarBorradorEnStorage();
    this.bumpFormTick();
  }

  // =========================
  // Storage borrador (Electron robusto)
  // =========================
  private leerBorradorRaw(): string | null {
    const sessionRaw = sessionStorage.getItem(STORAGE_KEY_INSCRIPCION);
    if (sessionRaw) return sessionRaw;
    if (this.esElectronApp) return localStorage.getItem(STORAGE_KEY_INSCRIPCION);
    return null;
  }

  private guardarBorradorRaw(raw: string): void {
    sessionStorage.setItem(STORAGE_KEY_INSCRIPCION, raw);
    if (this.esElectronApp) localStorage.setItem(STORAGE_KEY_INSCRIPCION, raw);
  }

  private limpiarBorradorStorage(): void {
    sessionStorage.removeItem(STORAGE_KEY_INSCRIPCION);
    if (this.esElectronApp) localStorage.removeItem(STORAGE_KEY_INSCRIPCION);
  }

  private detectarElectron(): boolean {
    if (typeof window === 'undefined') return false;

    const w = window as any;
    if (Boolean(w?.electron)) return true;

    const ua = String(navigator?.userAgent ?? '').toLowerCase();
    return ua.includes('electron');
  }
}
