import {
  Component,
  OnInit,
  inject,
  signal,
  DestroyRef,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SocioService } from '../../services/socio-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';
import { PaqueteService } from '../../services/paquete-service';

import { SocioData } from '../../model/socio-data';
import { PagoData } from '../../model/membresia-data';

import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { ResumenCompra } from '../resumen-compra/resumen-compra';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { hoyISO } from '../../util/fechas-precios';

// Ticket
import { JwtHelperService } from '@auth0/angular-jwt';
import { GimnasioService } from '../../services/gimnasio-service';
import { TicketService, VentaContexto } from '../../services/ticket-service';
import { GimnasioData } from '../../model/gimnasio-data';
import { environment } from '../../../environments/environment';
import { crearContextoTicket } from '../../util/ticket-contexto';

// Huella
import { HuellaModal } from '../huella-modal/huella-modal';
import { HttpErrorResponse } from '@angular/common/http';

// NgRx
import { Store } from '@ngrx/store';
import { ReinscripcionActions } from './state/reinscripcion-actions';
import {
  selectListaPaquetes,
  selectPaqueteActual,
  selectPrecioPaquete,
  selectTotalVista,
  selectTotalSinDescuento,
  selectFechaPagoVista,
  selectDescuento,
  selectFechaInicio,
  selectPaqueteId,
} from './state/reinscripcion-selectors';

// ✅ Asesoría nutricional (nuevo endpoint estado)
import { AsesoriaNutricionalService, AsesoriaNutricionalEstadoDTO } from 'src/app/services/asesoria-nutricional-service';

import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

const STORAGE_KEY_REINSCRIPCION_GRUPAL = 'ra_reinscripcion_grupal_v1';

type Draft = {
  paqueteId: number;
  pagosBySocioId: Record<string, PagoData[]>;
  miembrosIds: number[];
};

@Component({
  selector: 'app-reinscripcion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ResumenCompra,
    TiempoPlanLabelPipe,
    HuellaModal,
  ],
  templateUrl: './reinscripcion.html',
  styleUrl: './reinscripcion.css',
})
export class Reinscripcion implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private socioSrv = inject(SocioService);
  private membresiaSrv = inject(MembresiaService);
  private paqueteSrv = inject(PaqueteService);
  private notify = inject(NotificacionService);

  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt = inject(JwtHelperService);

  private store = inject(Store);

  // ✅ Asesoría Nutricional
  private asesoriaSrv = inject(AsesoriaNutricionalService);

  // Contexto ticket
  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // Estado
  idSocio!: number;
  socioPrincipalSig = signal<SocioData | null>(null);

  cargandoPaquetes = true;
  errorPaquetes: string | null = null;

  guardando = false;
  mensajeError: string | null = null;

  // Huella
  mostrarModalHuella = signal(false);

  // Modal resumen (cobro por integrante)
  mostrarResumen = signal(false);
  cobrandoIndex = signal<number>(0);

  // Integrantes
  miembrosSig = signal<SocioData[]>([]);
  pagosBySocioIdSig = signal<Record<string, PagoData[]>>({});

  socioBuscarIdCtrl = this.fb.nonNullable.control<number>(0, [Validators.min(1)]);

  // ✅ Estado asesoría por socio (SOLO se muestra si existe asesoría)
  estadoAsesoriaBySocioIdSig = signal<Record<string, AsesoriaNutricionalEstadoDTO>>({});
  cargandoEstadoAsesoriaSig = signal(false);
  validandoAsesoriaSig = signal(false);

  // Form
  form = this.fb.group({
    paqueteId: this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento: this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>(hoyISO()),
    movimiento: this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION'),
  });

  // Store signals
  listaPaquetesSig = this.store.selectSignal(selectListaPaquetes);
  paqueteActualSig = this.store.selectSignal(selectPaqueteActual);
  precioPaqueteSig = this.store.selectSignal(selectPrecioPaquete);
  totalVistaSig = this.store.selectSignal(selectTotalVista);
  totalSinDescSig = this.store.selectSignal(selectTotalSinDescuento);
  fechaPagoVistaSig = this.store.selectSignal(selectFechaPagoVista);
  descuentoSelSig = this.store.selectSignal(selectDescuento);
  fechaInicioSelSig = this.store.selectSignal(selectFechaInicio);
  paqueteIdSelSig = this.store.selectSignal(selectPaqueteId);

  // Helpers para template
  key(id: number | null | undefined): string {
    return String(id ?? '');
  }

  constructor() {
    // form -> store
    this.form.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) =>
        this.store.dispatch(
          ReinscripcionActions.setPaqueteId({ paqueteId: Number(id ?? 0) })
        )
      );

    this.form.controls.descuento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((d) =>
        this.store.dispatch(
          ReinscripcionActions.setDescuento({ descuento: Number(d ?? 0) })
        )
      );

    this.form.controls.fechaInicio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((f) =>
        this.store.dispatch(
          ReinscripcionActions.setFechaInicio({ fechaInicio: String(f ?? hoyISO()) })
        )
      );
  }

  // ========= modalidad requerida =========
  private cantidadRequerida(modalidad: any): number {
    const m = String(modalidad ?? 'INDIVIDUAL').toUpperCase();
    if (m === 'DUO') return 2;
    if (m === 'TRIO') return 3;
    if (m === 'SQUAD') return 5;
    return 1;
  }

  requeridoSig = computed(() => {
    const p = this.paqueteActualSig();
    return this.cantidadRequerida((p as any)?.modalidad);
  });

  esGrupalSig = computed(() => this.requeridoSig() > 1);

  faltanIntegrantesSig = computed(() => {
    const req = this.requeridoSig();
    const have = this.miembrosSig().length;
    return Math.max(0, req - have);
  });

  socioCobrandoSig = computed(() => {
    const idx = this.cobrandoIndex();
    return this.miembrosSig()[idx] ?? null;
  });

  socioCobrandoNombreSig = computed(() => {
    const s = this.socioCobrandoSig();
    if (!s) return '';
    return `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim();
  });

  conceptoResumenSig = computed(() => {
    const paquete = this.paqueteActualSig();
    const nombre = paquete?.nombre ?? 'Paquete';

    if (!this.esGrupalSig()) return nombre;

    const idx = this.cobrandoIndex() + 1;
    const req = this.requeridoSig();
    return `${nombre} · Integrante ${idx} de ${req}`;
  });

  // ✅ ¿Cuándo validar asesoría?
  private requiereValidarAsesoriaNutricional(): boolean {
    const p: any = this.paqueteActualSig() as any;
    if (!p) return false;

    // 1) flags si existen
    if (p?.requiereAsesoriaNutricional === true) return true;
    if (p?.esAsesoriaNutricional === true) return true;

    // 2) tipo si existe
    const tipo = String(p?.tipoPaquete ?? p?.tipo ?? '').toUpperCase();
    if (tipo.includes('ASESORIA')) return true;
    if (tipo.includes('NUTRI')) return true;

    // 3) heurística por nombre
    const nombre = String(p?.nombre ?? '').toLowerCase();
    if (nombre.includes('asesor')) return true;
    if (nombre.includes('nutri')) return true;

    return false;
  }

  // =========================
  // Init
  // =========================
  ngOnInit(): void {
    this.cargarContextoDesdeToken();
    this.cargarDraft();

    this.idSocio = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.idSocio) {
      this.notify.error('Falta el id del socio.');
      this.router.navigate(['/pages/socio']);
      return;
    }

    // Cargar socio principal
    this.socioSrv.buscarPorId(this.idSocio).subscribe({
      next: (s) => {
        const socio = s ?? null;
        this.socioPrincipalSig.set(socio);

        if (socio?.idSocio) {
          const ya = this.miembrosSig().some((x) => Number(x.idSocio) === Number(socio.idSocio));
          if (!ya) this.miembrosSig.set([socio, ...this.miembrosSig()]);
        }

        // ✅ cargar estado asesoría SOLO para los miembros actuales
        this.refrescarEstadosAsesoria();

        this.guardarDraft();
      },
      error: () => this.notify.error('No se pudo cargar el socio.'),
    });

    // Cargar paquetes
    this.cargandoPaquetes = true;
    this.errorPaquetes = null;
    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        const activos = (lista ?? []).filter((p) => p?.activo !== false);
        this.store.dispatch(ReinscripcionActions.setListaPaquetes({ paquetes: activos }));
        this.cargandoPaquetes = false;

        // Auto-paquete anterior
        this.cargarPaqueteAnteriorDelSocio(this.idSocio);
      },
      error: () => {
        this.errorPaquetes = 'No se pudieron cargar los paquetes.';
        this.cargandoPaquetes = false;
      },
    });
  }

  // =========================
  // Asesoría: cargar estado por socio (solo si existe asesoría)
  // =========================
  private refrescarEstadosAsesoria(): void {
    const miembros = this.miembrosSig() ?? [];
    if (!miembros.length) return;

    const ids = Array.from(new Set(miembros.map((m) => Number(m.idSocio ?? 0)).filter((x) => x > 0)));
    if (!ids.length) return;

    this.cargandoEstadoAsesoriaSig.set(true);

    forkJoin(
      ids.map((id) =>
        this.asesoriaSrv.estado(id).pipe(
          catchError((err) => {
            console.error('Error estado asesoría', id, err);
            // Si falla el endpoint por red, no mostramos nada (no afectamos UI)
            return of(null as any);
          })
        )
      )
    )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoEstadoAsesoriaSig.set(false))
      )
      .subscribe((arr) => {
        const map: Record<string, AsesoriaNutricionalEstadoDTO> = {};
        for (let i = 0; i < ids.length; i++) {
          const idSocio = ids[i];
          const dto = arr[i] as AsesoriaNutricionalEstadoDTO | null;

          // ✅ regla: si NO tiene asesoría -> NO guardamos nada (no se muestra nada)
          if (dto && dto.asesorado) {
            map[this.key(idSocio)] = dto;
          }
        }
        this.estadoAsesoriaBySocioIdSig.set(map);
      });
  }

  estadoAsesoriaDe(idSocio: number): AsesoriaNutricionalEstadoDTO | null {
    const map = this.estadoAsesoriaBySocioIdSig() ?? {};
    return map[this.key(idSocio)] ?? null;
  }

  private nombreSocio(s: SocioData | null): string {
    if (!s) return '—';
    return `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() || `ID ${s.idSocio ?? ''}`;
  }

  private validarAsesoriaAntesDeContinuar(next: () => void): void {
    // Si no aplica, continuar
    if (!this.requiereValidarAsesoriaNutricional()) {
      next();
      return;
    }

    const miembros = this.miembrosSig() ?? [];
    if (!miembros.length) {
      this.mensajeError = 'No hay socios seleccionados.';
      return;
    }

    this.validandoAsesoriaSig.set(true);
    this.mensajeError = null;

    // Validación correcta: consultar /estado por cada miembro y decidir
    forkJoin(
      miembros.map((m) =>
        this.asesoriaSrv.estado(Number(m.idSocio)).pipe(
          catchError((err) => {
            console.error('Error validando estado asesoría', m?.idSocio, err);
            return of({
              asesorado: false,
              vigente: false,
              activo: false,
              estado: 'SIN_ASESORIA',
              fechaInicio: null,
              fechaFin: null,
              idAsesoriaNutricional: null,
            } as AsesoriaNutricionalEstadoDTO);
          })
        )
      )
    )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.validandoAsesoriaSig.set(false))
      )
      .subscribe((arr) => {
        // Actualizamos cache UI (solo los que sí tengan asesoría)
        const current = { ...(this.estadoAsesoriaBySocioIdSig() ?? {}) };
        for (let i = 0; i < miembros.length; i++) {
          const socio = miembros[i];
          const dto = arr[i];

          if (dto?.asesorado) current[this.key(Number(socio.idSocio))] = dto;
          else delete current[this.key(Number(socio.idSocio))];
        }
        this.estadoAsesoriaBySocioIdSig.set(current);

        // Regla de bloqueo:
        // - Si NO asesorado => bloquear
        // - Si asesorado pero NO vigente => bloquear
        for (let i = 0; i < miembros.length; i++) {
          const socio = miembros[i];
          const dto = arr[i];

          if (!dto?.asesorado) {
            this.mensajeError =
              `El socio "${this.nombreSocio(socio)}" no tiene asesoría nutricional registrada con Roberto. ` +
              `No se puede reinscribir este paquete.`;
            return;
          }

          if (!dto?.vigente) {
            const finTxt = dto?.fechaFin ? ` (Vigencia: ${dto.fechaFin})` : '';
            this.mensajeError =
              `La asesoría nutricional de "${this.nombreSocio(socio)}" no está vigente ` +
              `(${dto?.estado ?? 'NO_VIGENTE'})${finTxt}. No se puede reinscribir este paquete.`;
            return;
          }
        }

        // todo OK
        next();
      });
  }

  // =========================
  // Paquete anterior auto
  // =========================
  private cargarPaqueteAnteriorDelSocio(idSocio: number): void {
    this.membresiaSrv.buscarMembresiasPorSocio(idSocio, 1, 1).subscribe({
      next: (page) => {
        const rows: any[] = (page as any)?.content ?? (page as any)?.items ?? (page as any)?.data ?? [];
        const ultima = rows?.[0] ?? null;
        const idPaquete = Number(ultima?.paquete?.idPaquete ?? 0);

        if (!idPaquete) {
          this.form.controls.paqueteId.enable({ emitEvent: false });
          return;
        }

        this.form.controls.paqueteId.setValue(idPaquete, { emitEvent: true });
        this.form.controls.paqueteId.disable({ emitEvent: false });

        this.store.dispatch(ReinscripcionActions.setPaqueteId({ paqueteId: idPaquete }));
        this.guardarDraft();
      },
      error: () => {
        this.form.controls.paqueteId.enable({ emitEvent: false });
      },
    });
  }

  desbloquearPaquete(): void {
    if (this.guardando) return;

    if (this.miembrosSig().length > 1) {
      this.notify.aviso('Quita integrantes extra antes de cambiar el paquete.');
      return;
    }

    this.form.controls.paqueteId.enable({ emitEvent: false });
    this.notify.aviso('Paquete desbloqueado.');
  }

  // =========================
  // Integrantes (ID)
  // =========================
  agregarSocioPorId(): void {
    if (this.guardando) return;

    const id = Number(this.socioBuscarIdCtrl.value ?? 0);
    if (!id || id <= 0) {
      this.notify.aviso('Ingresa un ID válido.');
      return;
    }

    if (this.miembrosSig().some((m) => Number(m.idSocio) === id)) {
      this.notify.aviso('Ese socio ya está agregado.');
      return;
    }

    if (this.miembrosSig().length >= this.requeridoSig()) {
      this.notify.aviso('Ya completaste los integrantes requeridos.');
      return;
    }

    this.socioSrv.buscarPorId(id).subscribe({
      next: (s) => {
        if (!s?.idSocio) {
          this.notify.aviso('No se encontró el socio.');
          return;
        }

        this.miembrosSig.set([...this.miembrosSig(), s]);
        this.socioBuscarIdCtrl.setValue(0);

        // ✅ refrescar estado asesoría del nuevo miembro (sin afectar si no tiene)
        this.refrescarEstadosAsesoria();

        this.guardarDraft();
        this.notify.exito('Socio agregado.');
      },
      error: () => this.notify.error('No se pudo cargar el socio por ID.'),
    });
  }

  quitarMiembro(idSocio: number): void {
    if (this.guardando) return;

    const principalId = Number(this.socioPrincipalSig()?.idSocio ?? 0);
    if (Number(idSocio) === principalId) {
      this.notify.aviso('No puedes quitar al socio principal.');
      return;
    }

    const map = { ...(this.pagosBySocioIdSig() ?? {}) };
    delete map[this.key(idSocio)];
    this.pagosBySocioIdSig.set(map);

    this.miembrosSig.set(this.miembrosSig().filter((m) => Number(m.idSocio) !== Number(idSocio)));

    // ✅ limpiar estado asesoría del que quitaste
    const est = { ...(this.estadoAsesoriaBySocioIdSig() ?? {}) };
    delete est[this.key(idSocio)];
    this.estadoAsesoriaBySocioIdSig.set(est);

    const idx = this.cobrandoIndex();
    if (idx >= this.miembrosSig().length) {
      this.cobrandoIndex.set(Math.max(0, this.miembrosSig().length - 1));
    }

    this.guardarDraft();
  }

  // =========================
  // Huella
  // =========================
  abrirModalHuella(): void {
    if (this.guardando) return;
    this.mostrarModalHuella.set(true);
  }

  onHuellaCancel(): void {
    this.mostrarModalHuella.set(false);
  }

  onHuellaOk(res: { muestras: string[]; calidades: number[] }): void {
    this.mostrarModalHuella.set(false);

    let idx = 0;
    if (Array.isArray(res.calidades) && res.calidades.length === res.muestras.length && res.calidades.length > 0) {
      let best = Number.POSITIVE_INFINITY;
      res.calidades.forEach((q, i) => {
        if (q < best) {
          best = q;
          idx = i;
        }
      });
    }

    const huellaBase64 = res.muestras[idx] ?? null;
    if (!huellaBase64) {
      this.notify.aviso('No se obtuvo una huella válida.');
      return;
    }

    if (this.miembrosSig().length >= this.requeridoSig()) {
      this.notify.aviso('Ya completaste los integrantes requeridos.');
      return;
    }

    this.socioSrv.buscarPorHuella(huellaBase64).subscribe({
      next: (s) => {
        if (!s?.idSocio) {
          this.notify.aviso('No se encontró socio para esa huella.');
          return;
        }
        if (this.miembrosSig().some((m) => Number(m.idSocio) === Number(s.idSocio))) {
          this.notify.aviso('Ese socio ya está agregado.');
          return;
        }

        this.miembrosSig.set([...this.miembrosSig(), s]);

        // ✅ refrescar estado asesoría del nuevo miembro
        this.refrescarEstadosAsesoria();

        this.guardarDraft();
        this.notify.exito('Socio agregado por huella.');
      },
      error: () => this.notify.error('No se pudo buscar socio por huella.'),
    });
  }

  // =========================
  // Cobro
  // =========================
  abrirResumen(): void {
    if (this.guardando) return;

    const paquete = this.paqueteActualSig();
    if (!paquete || (paquete as any)?.activo === false) {
      this.notify.aviso('Selecciona un paquete activo.');
      return;
    }

    if (this.esGrupalSig() && this.faltanIntegrantesSig() > 0) {
      this.mensajeError = `Faltan ${this.faltanIntegrantesSig()} integrante(s) para completar el paquete.`;
      return;
    }

    this.validarAsesoriaAntesDeContinuar(() => {
      const miembros = this.miembrosSig();
      const map = this.pagosBySocioIdSig();
      const idx = miembros.findIndex((m) => !map[this.key(m.idSocio!)]);
      this.cobrandoIndex.set(idx >= 0 ? idx : 0);

      this.mensajeError = null;
      this.mostrarResumen.set(true);
    });
  }

  cerrarResumen(): void {
    this.mostrarResumen.set(false);
  }

  confirmarPago(pagos: PagoData[]): void {
    const socio = this.socioCobrandoSig();
    const paquete = this.paqueteActualSig();
    if (!socio?.idSocio || !paquete?.idPaquete) {
      this.notify.error('Falta socio o paquete.');
      return;
    }

    const total = this.totalVistaSig() ?? 0;
    const suma = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(total - suma) > 0.01) {
      this.notify.aviso('La suma de pagos no coincide con el total.');
      return;
    }

    const map = { ...(this.pagosBySocioIdSig() ?? {}) };
    map[this.key(socio.idSocio)] = pagos ?? [];
    this.pagosBySocioIdSig.set(map);
    this.guardarDraft();

    this.mostrarResumen.set(false);

    const miembros = this.miembrosSig();
    const faltan = miembros.filter((m) => !this.pagosBySocioIdSig()[this.key(m.idSocio!)]).length;

    if (faltan > 0) {
      this.notify.exito(`Pago capturado. Faltan ${faltan} integrante(s) por cobrar.`);
      return;
    }

    // ✅ validar otra vez antes de guardar
    this.validarAsesoriaAntesDeContinuar(() => this.guardarTodo());
  }

  private guardarTodo(): void {
    const paquete = this.paqueteActualSig();
    if (!paquete?.idPaquete) {
      this.notify.error('Selecciona un paquete.');
      return;
    }

    const miembros = this.miembrosSig();
    if (!miembros.length) {
      this.notify.error('No hay socios seleccionados.');
      return;
    }

    const descuento = Number(this.descuentoSelSig() ?? 0);
    const map = this.pagosBySocioIdSig();

    const membresiasPayload = miembros.map((m) => ({
      socio: { idSocio: m.idSocio },
      paquete: { idPaquete: paquete.idPaquete },
      movimiento: 'REINSCRIPCION',
      descuento,
      pagos: map[this.key(m.idSocio!)] ?? [],
    }));

    const sinPago = miembros.filter((m) => !(map[this.key(m.idSocio!)]?.length));
    if (sinPago.length) {
      this.notify.aviso('Faltan pagos por capturar para algunos integrantes.');
      return;
    }

    this.guardando = true;

    const requerido = this.requeridoSig();
    const esBatch = requerido > 1;

    if (esBatch) {
      this.membresiaSrv.guardarBatch(membresiasPayload as any).subscribe({
        next: (respArr: any) => {
          this.guardando = false;

          const lista = Array.isArray(respArr) ? respArr : [];
          for (let i = 0; i < miembros.length; i++) {
            const r = lista[i] ?? {};
            const socio = miembros[i];
            const pagos = map[this.key(socio.idSocio!)] ?? [];
            this.imprimirTicket(r, socio, pagos, paquete);
          }

          this.limpiarTodo();
          this.notify.exito('Reinscripción grupal guardada.');
          this.router.navigate(['/pages/socio', this.idSocio, 'historial']);
        },
        error: (err: HttpErrorResponse) => {
          this.guardando = false;
          this.notify.error(this.extraerMensajeError(err));
        },
      });
      return;
    }

    this.membresiaSrv.guardar(membresiasPayload[0] as any).subscribe({
      next: (resp: any) => {
        this.guardando = false;

        const socio = miembros[0];
        const pagos = map[this.key(socio.idSocio!)] ?? [];
        this.imprimirTicket(resp, socio, pagos, paquete);

        this.limpiarTodo();
        this.notify.exito('Reinscripción guardada.');
        this.router.navigate(['/pages/socio', this.idSocio, 'historial']);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando = false;
        this.notify.error(this.extraerMensajeError(err));
      },
    });
  }

  private imprimirTicket(resp: any, socio: SocioData, pagos: PagoData[], paquete: any): void {
    const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);

    const pagosDet = (pagos ?? [])
      .filter((p) => (Number(p.monto) || 0) > 0)
      .map((p) => ({ metodo: p.tipoPago, monto: Number(p.monto) || 0 }));

    const folioTicket = resp?.folio;

    this.ticket.imprimirMembresiaDesdeContexto({
      ctx,
      folio: folioTicket,
      fecha: new Date(),
      socioNombre: `${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim(),
      paqueteNombre: resp?.paquete?.nombre ?? paquete?.nombre ?? null,
      precioPaquete: Number(resp?.paquete?.precio ?? paquete?.precio ?? 0),
      descuento: Number(resp?.descuento ?? this.descuentoSelSig() ?? 0),
      costoInscripcion: 0,
      pagos: pagosDet,
      referencia: resp?.referencia,
    });
  }

  private limpiarTodo(): void {
    const principal = this.socioPrincipalSig();

    this.miembrosSig.set(principal ? [principal] : []);
    this.pagosBySocioIdSig.set({});
    this.cobrandoIndex.set(0);

    // ✅ limpia UI de asesorías también (queda igual que ahora si no tiene)
    this.estadoAsesoriaBySocioIdSig.set({});

    sessionStorage.removeItem(STORAGE_KEY_REINSCRIPCION_GRUPAL);
    this.store.dispatch(ReinscripcionActions.reset());

    if (principal?.idSocio) {
      this.cargarPaqueteAnteriorDelSocio(principal.idSocio);
      this.refrescarEstadosAsesoria();
    }
  }

  // =========================
  // Draft
  // =========================
  private cargarDraft(): void {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_REINSCRIPCION_GRUPAL);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;

      if (d?.pagosBySocioId) this.pagosBySocioIdSig.set(d.pagosBySocioId);
    } catch {
      // noop
    }
  }

  private guardarDraft(): void {
    try {
      const d: Draft = {
        paqueteId: Number(this.form.controls.paqueteId.value ?? 0),
        pagosBySocioId: this.pagosBySocioIdSig(),
        miembrosIds: this.miembrosSig().map((m) => Number(m.idSocio ?? 0)).filter((x) => x > 0),
      };
      sessionStorage.setItem(STORAGE_KEY_REINSCRIPCION_GRUPAL, JSON.stringify(d));
    } catch {
      // noop
    }
  }

  // =========================
  // Errors
  // =========================
  private extraerMensajeError(err: HttpErrorResponse): string {
    const e: any = err?.error;
    if (e?.detail) return String(e.detail);
    if (e?.title) return String(e.title);
    if (e?.message) return String(e.message);
    if (typeof e === 'string') return e;
    return err?.message || 'No se pudo completar la reinscripción.';
  }

  // =========================
  // Token
  // =========================
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
      /* noop */
    }
  }
}
