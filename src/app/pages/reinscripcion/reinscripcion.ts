// src/app/pages/reinscripcion/reinscripcion.ts

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
import { PaqueteData } from '../../model/paquete-data';

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

// ✅ Asesoría nutricional
import {
  AsesoriaNutricionalService,
  AsesoriaNutricionalEstadoDTO,
} from 'src/app/services/asesoria-nutricional-service';

import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

// ✅ Promos
import { PromocionData } from 'src/app/model/promocion-data';

const STORAGE_KEY_REINSCRIPCION_GRUPAL = 'ra_reinscripcion_grupal_v1';

type Draft = {
  paqueteId: number;
  pagosBySocioId: Record<string, PagoData[]>;
  miembrosIds: number[];
};

type EstudiantilCheck = {
  socioId: number;
  nombre: string;

  edad: number | null;
  edadOk: boolean;
  motivoEdad: string | null;

  vigencia: string | null;
  vigenciaOk: boolean;
  motivoVigencia: string | null;
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

  // =========================
  // ✅ BUSCADOR DE PAQUETES (NUEVO)
  // =========================
  paqueteBusquedaSig = signal<string>('');
  paqueteDropdownAbiertoSig = signal<boolean>(false);
  paqueteIdSig = signal<number>(0);

  private setPaqueteId(id: number, emitEvent = true): void {
    const v = Number(id ?? 0);
    this.paqueteIdSig.set(v);
    this.form.controls.paqueteId.setValue(v, { emitEvent });
    this.form.controls.paqueteId.updateValueAndValidity({ emitEvent });
  }

  // ✅ Estado asesoría por socio (SOLO se muestra si existe asesoría)
  estadoAsesoriaBySocioIdSig = signal<Record<string, AsesoriaNutricionalEstadoDTO>>({});
  cargandoEstadoAsesoriaSig = signal(false);
  validandoAsesoriaSig = signal(false);

  // ✅ Bloqueo real del paquete (para UI)
  paqueteBloqueadoSig = signal(false);

  // =========================
  // ✅ PROMOCIONES EN REINSCRIPCIÓN
  // =========================
  promoCargandoSig = signal(false);
  promoErrorSig = signal<string | null>(null);
  promocionAplicadaSig = signal<PromocionData | null>(null);

  private num(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  private round2(n: number): number {
    return Math.round(this.num(n) * 100) / 100;
  }
  private keyOf(id: number | null | undefined): string {
    return String(id ?? '');
  }

  // ✅ normalización para búsqueda (sin acentos)
  private norm(s: any): string {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // ✅ Lista COMPLETA de paquetes (sin filtrar activos en init)
  listaPaquetesSig = this.store.selectSignal(selectListaPaquetes);

  // ✅ paquetes ACTIVOS filtrados por búsqueda
  paquetesSugeridosSig = computed(() => {
    const q = this.norm(this.paqueteBusquedaSig());
    const lista = (this.listaPaquetesSig() ?? []).filter((p: any) => p?.activo !== false);

    if (!q) return lista.slice(0, 12);

    return lista
      .filter((p: any) => {
        const nombre = this.norm(p?.nombre);
        return nombre.includes(q);
      })
      .slice(0, 25);
  });

  private promoEsValidaParaReinscripcion(p: PromocionData): boolean {
    if (!p) return false;
    if (p.activo === false) return false;

    // ✅ Reinscripción: NO promos solo nuevos / no inscripción
    if (p.soloNuevos === true) return false;
    if (p.sinCostoInscripcion === true) return false;

    return true;
  }

  private elegirMejorPromo(promos: PromocionData[]): PromocionData | null {
    const list = (promos ?? []).filter((p) => this.promoEsValidaParaReinscripcion(p));
    if (!list.length) return null;

    list.sort((a, b) => {
      const pa = this.num(a.prioridad);
      const pb = this.num(b.prioridad);
      if (pa !== pb) return pb - pa;
      return this.num(b.idPromocion) - this.num(a.idPromocion);
    });

    return list[0] ?? null;
  }

  private descuentoDePromo(precioBase: number, promo: PromocionData | null): number {
    if (!promo) return 0;

    const tipo = String(promo.tipo ?? '').toUpperCase();

    const pct = this.num(promo.descuentoPorcentaje);
    if (tipo.includes('PORC') && pct > 0) {
      return this.round2((precioBase * pct) / 100);
    }

    const monto = this.num(promo.descuentoMonto);
    if ((tipo.includes('MONTO') || tipo.includes('FIJO') || tipo.includes('CANT')) && monto > 0) {
      return this.round2(monto);
    }

    if (pct > 0) return this.round2((precioBase * pct) / 100);
    if (monto > 0) return this.round2(monto);

    return 0;
  }

  private cargarPromoDePaquete(idPaquete: number): void {
    const id = Number(idPaquete ?? 0);
    if (!id) {
      this.promocionAplicadaSig.set(null);
      this.promoErrorSig.set(null);
      return;
    }

    this.promoCargandoSig.set(true);
    this.promoErrorSig.set(null);

    this.paqueteSrv.buscarPromocionesVigentes(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.promoCargandoSig.set(false)),
        catchError((err) => {
          console.error('Error cargando promociones vigentes', err);
          this.promoErrorSig.set('No se pudieron cargar promociones vigentes.');
          return of([] as PromocionData[]);
        })
      )
      .subscribe((promos) => {
        const best = this.elegirMejorPromo(promos ?? []);
        this.promocionAplicadaSig.set(best);
      });
  }

  // =========================
  // ✅ Validación ESTUDIANTIL
  // =========================
  mostrarModalEstudiantilSig = signal(false);
  checksEstudiantilModalSig = signal<EstudiantilCheck[]>([]);
  guardandoVigenciaBySocioIdSig = signal<Record<string, boolean>>({});
  vigenciaNuevaBySocioIdSig = signal<Record<string, string>>({});

  private nextAfterValidacionEstudiantil: (() => void) | null = null;

  puedeContinuarEstudiantilSig = computed(() => {
    const checks = this.checksEstudiantilModalSig() ?? [];
    if (!checks.length) return true;
    return checks.every((c) => c.edadOk && c.vigenciaOk);
  });

  checksEstudiantilVistaSig = computed(() => {
    if (!this.requiereValidarEstudiantil()) return [];
    return this.generarChecksEstudiantil();
  });

  tienePendientesEstudiantilSig = computed(() => {
    const arr = this.checksEstudiantilVistaSig() ?? [];
    return arr.some((c) => !c.edadOk || !c.vigenciaOk);
  });

  // Form
  form = this.fb.group({
    paqueteId: this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento: this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>(hoyISO()),
    movimiento: this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION'),
  });

  // Store signals
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
    return this.keyOf(id);
  }
  todayIso(): string {
    return hoyISO();
  }

  constructor() {
    // ✅ init signal
    this.paqueteIdSig.set(Number(this.form.controls.paqueteId.value ?? 0));

    // form -> store
    this.form.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        const pid = Number(id ?? 0);
        this.paqueteIdSig.set(pid);
        this.store.dispatch(ReinscripcionActions.setPaqueteId({ paqueteId: pid }));

        // ✅ cargar promo para reinscripción
        this.cargarPromoDePaquete(pid);

        // ✅ sincronizar texto del buscador
        this.syncPaqueteBusquedaConSeleccion();
      });

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
          ReinscripcionActions.setFechaInicio({
            fechaInicio: String(f ?? hoyISO()),
          })
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

  // =========================
  // ✅ Cálculos con PROMO (reinscripción)
  // =========================
  promoMesesGratisSig = computed(() => {
    const p = this.promocionAplicadaSig();
    return this.num(p?.mesesGratis);
  });

  descuentoPromoSig = computed(() => {
    const paquete: any = this.paqueteActualSig() as any;
    const base = this.num(paquete?.precio);
    const promo = this.promocionAplicadaSig();
    if (!promo || !base) return 0;
    return this.round2(Math.max(0, this.descuentoDePromo(base, promo)));
  });

  precioConPromoSig = computed(() => {
    const paquete: any = this.paqueteActualSig() as any;
    const base = this.num(paquete?.precio);
    const dp = this.descuentoPromoSig();
    return this.round2(Math.max(0, base - dp));
  });

  totalConPromoSig = computed(() => {
    const descManual = this.num(this.descuentoSelSig() ?? 0);
    const total = this.precioConPromoSig() - descManual;
    return this.round2(Math.max(0, total));
  });

  descuentoTotalSig = computed(() => {
    return this.round2(this.num(this.descuentoSelSig() ?? 0) + this.descuentoPromoSig());
  });

  // =========================
  // ✅ Buscador Paquetes (helpers)
  // =========================
  private paqueteLabel(p: PaqueteData | null): string {
    if (!p) return '';
    return String((p as any)?.nombre ?? '').trim();
  }

  private syncPaqueteBusquedaConSeleccion(): void {
    if (this.paqueteDropdownAbiertoSig()) return;

    const id = Number(this.form.controls.paqueteId.value ?? 0);
    if (!id) {
      this.paqueteBusquedaSig.set('');
      return;
    }

    const lista = this.listaPaquetesSig() ?? [];
    const sel = lista.find((x: any) => Number(x?.idPaquete) === id) ?? null;
    this.paqueteBusquedaSig.set(this.paqueteLabel(sel));
  }

  abrirDropdownPaquetes(): void {
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;
    this.paqueteDropdownAbiertoSig.set(true);
  }

  cerrarDropdownPaquetes(): void {
    const wasOpen = this.paqueteDropdownAbiertoSig();
    this.paqueteDropdownAbiertoSig.set(false);
    if (!wasOpen) return;

    // al cerrar, revertimos al seleccionado actual
    this.syncPaqueteBusquedaConSeleccion();
  }

  onPaqueteBusquedaChange(v: string): void {
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    this.paqueteBusquedaSig.set(v);
    this.paqueteDropdownAbiertoSig.set(true);
  }

  seleccionarPaqueteDesdeBusqueda(p: PaqueteData, evt?: Event): void {
    evt?.stopPropagation();
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    const id = Number((p as any)?.idPaquete ?? 0);
    if (!id) {
      this.notify.aviso('No se pudo seleccionar el paquete (id inválido).');
      return;
    }

    // ✅ dispara valueChanges -> store + promo
    this.setPaqueteId(id, true);

    // sincroniza texto
    this.paqueteBusquedaSig.set(this.paqueteLabel(p));

    // cierra dropdown
    this.paqueteDropdownAbiertoSig.set(false);
  }

  limpiarPaqueteSeleccionado(evt?: Event): void {
    evt?.stopPropagation();
    if (this.paqueteBloqueadoSig() || this.cargandoPaquetes) return;

    this.setPaqueteId(0, true);
    this.paqueteBusquedaSig.set('');
    this.paqueteDropdownAbiertoSig.set(false);
  }

  // =========================
  // ✅ ¿Cuándo validar asesoría?
  // =========================
  private requiereValidarAsesoriaNutricional(): boolean {
    const p: any = this.paqueteActualSig() as any;
    if (!p) return false;

    if (p?.requiereAsesoriaNutricional === true) return true;
    if (p?.esAsesoriaNutricional === true) return true;

    const tipo = String(p?.tipoPaquete ?? p?.tipo ?? '').toUpperCase();
    if (tipo.includes('ASESORIA')) return true;
    if (tipo.includes('NUTRI')) return true;

    const nombre = String(p?.nombre ?? '').toLowerCase();
    if (nombre.includes('asesor')) return true;
    if (nombre.includes('nutri')) return true;

    return false;
  }

  // ✅ ¿Cuándo validar paquete estudiantil?
  private requiereValidarEstudiantil(): boolean {
    const p: any = this.paqueteActualSig() as any;
    if (!p) return false;

    if (p?.estudiantil === true) return true;

    const nombre = String(p?.nombre ?? '').toLowerCase();
    if (nombre.includes('estudiant')) return true;

    const tipo = String(p?.tipoPaquete ?? p?.tipo ?? '').toUpperCase();
    if (tipo.includes('ESTUD')) return true;

    return false;
  }

  private calcularEdad(fechaNacimientoIso: string | null | undefined): number | null {
    if (!fechaNacimientoIso) return null;

    const d = new Date(String(fechaNacimientoIso).slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return null;

    const hoy = new Date(this.todayIso() + 'T00:00:00');
    let edad = hoy.getFullYear() - d.getFullYear();
    const m = hoy.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--;
    return edad;
  }

  private esVigenciaEstudianteValida(vigenciaIso: string | null | undefined): boolean {
    if (!vigenciaIso) return false;
    const v = String(vigenciaIso).slice(0, 10);
    return v >= this.todayIso();
  }

  private generarChecksEstudiantil(): EstudiantilCheck[] {
    const miembros = this.miembrosSig() ?? [];
    const checks: EstudiantilCheck[] = [];

    for (const m of miembros) {
      const id = Number((m as any)?.idSocio ?? 0);
      if (!id) continue;

      const nombre = `${(m as any)?.nombre ?? ''} ${(m as any)?.apellido ?? ''}`.trim() || `ID ${id}`;

      const edad = this.calcularEdad((m as any)?.fechaNacimiento);
      const edadOk = typeof edad === 'number' ? edad <= 22 : false;
      const motivoEdad =
        edad == null
          ? 'Fecha de nacimiento inválida o vacía.'
          : edadOk
            ? null
            : `Este socio tiene ${edad} años. El límite del paquete estudiantil es 22.`;

      const vigencia = (m as any)?.credencialEstudianteVigencia
        ? String((m as any).credencialEstudianteVigencia).slice(0, 10)
        : null;

      const vigenciaOk = this.esVigenciaEstudianteValida(vigencia);
      const motivoVigencia = vigenciaOk
        ? null
        : vigencia
          ? `La credencial está vencida (vigencia: ${vigencia}).`
          : 'No hay vigencia registrada de credencial de estudiante.';

      checks.push({
        socioId: id,
        nombre,
        edad,
        edadOk,
        motivoEdad,
        vigencia,
        vigenciaOk,
        motivoVigencia,
      });
    }

    return checks;
  }

  abrirValidacionEstudiantilManual(): void {
    if (this.guardando) return;
    if (!this.requiereValidarEstudiantil()) return;

    const checks = this.generarChecksEstudiantil();
    this.checksEstudiantilModalSig.set(checks);
    this.prepararVigenciasNuevas(checks);

    this.nextAfterValidacionEstudiantil = null;
    this.mostrarModalEstudiantilSig.set(true);
  }

  cerrarModalEstudiantil(): void {
    this.mostrarModalEstudiantilSig.set(false);
    this.nextAfterValidacionEstudiantil = null;
  }

  private prepararVigenciasNuevas(checks: EstudiantilCheck[]): void {
    const map = { ...(this.vigenciaNuevaBySocioIdSig() ?? {}) };

    for (const c of checks) {
      const k = this.key(c.socioId);
      if (!map[k]) map[k] = c.vigencia ?? this.todayIso();
    }

    this.vigenciaNuevaBySocioIdSig.set(map);
  }

  vigenciaNuevaDe(idSocio: number): string {
    return (this.vigenciaNuevaBySocioIdSig() ?? {})[this.key(idSocio)] ?? this.todayIso();
  }

  setVigenciaNueva(idSocio: number, value: string): void {
    const map = { ...(this.vigenciaNuevaBySocioIdSig() ?? {}) };
    map[this.key(idSocio)] = String(value ?? '').slice(0, 10);
    this.vigenciaNuevaBySocioIdSig.set(map);
  }

  guardandoVigenciaDe(idSocio: number): boolean {
    return Boolean((this.guardandoVigenciaBySocioIdSig() ?? {})[this.key(idSocio)]);
  }

  guardarVigenciaEstudiante(idSocio: number): void {
    if (this.guardando) return;

    const fecha = this.vigenciaNuevaDe(idSocio);
    if (!fecha || fecha.length < 10) {
      this.notify.aviso('Selecciona una fecha válida para la vigencia.');
      return;
    }
    if (!this.esVigenciaEstudianteValida(fecha)) {
      this.notify.aviso('La vigencia debe ser hoy o una fecha futura.');
      return;
    }

    const miembros = this.miembrosSig() ?? [];
    const socio = miembros.find((x: any) => Number(x?.idSocio) === Number(idSocio)) ?? null;
    if (!(socio as any)?.idSocio) {
      this.notify.error('No se encontró el socio para actualizar.');
      return;
    }

    const loadingMap = { ...(this.guardandoVigenciaBySocioIdSig() ?? {}) };
    loadingMap[this.key(idSocio)] = true;
    this.guardandoVigenciaBySocioIdSig.set(loadingMap);

    const payload: any = {
      ...socio,
      activo: (socio as any).activo ?? true,
      credencialEstudianteVigencia: fecha,
    };

    this.socioSrv.actualizar(Number(idSocio), payload).pipe(
      finalize(() => {
        const m = { ...(this.guardandoVigenciaBySocioIdSig() ?? {}) };
        delete m[this.key(idSocio)];
        this.guardandoVigenciaBySocioIdSig.set(m);
      })
    ).subscribe({
      next: (updated) => {
        const lista = (this.miembrosSig() ?? []).map((x: any) =>
          Number(x?.idSocio) === Number(idSocio)
            ? { ...(x as any), ...(updated as any), credencialEstudianteVigencia: fecha }
            : x
        );
        this.miembrosSig.set(lista);

        const principal = this.socioPrincipalSig();
        if ((principal as any)?.idSocio && Number((principal as any).idSocio) === Number(idSocio)) {
          this.socioPrincipalSig.set({
            ...(principal as any),
            ...(updated as any),
            credencialEstudianteVigencia: fecha,
          });
        }

        const checks = this.generarChecksEstudiantil();
        this.checksEstudiantilModalSig.set(checks);
        this.prepararVigenciasNuevas(checks);

        this.guardarDraft();
        this.notify.exito('Vigencia de estudiante actualizada.');
      },
      error: (err: HttpErrorResponse) => {
        this.notify.error(this.extraerMensajeError(err));
      },
    });
  }

  private validarEstudiantilAntesDeContinuar(next: () => void): void {
    if (!this.requiereValidarEstudiantil()) {
      next();
      return;
    }

    const miembros = this.miembrosSig() ?? [];
    if (!miembros.length) {
      this.mensajeError = 'No hay socios seleccionados.';
      return;
    }

    const checks = this.generarChecksEstudiantil();
    this.checksEstudiantilModalSig.set(checks);
    this.prepararVigenciasNuevas(checks);

    const hayProblemas = checks.some((c) => !c.edadOk || !c.vigenciaOk);
    if (!hayProblemas) {
      next();
      return;
    }

    this.nextAfterValidacionEstudiantil = next;
    this.mostrarModalEstudiantilSig.set(true);
  }

  continuarDesdeModalEstudiantil(): void {
    const checks = this.generarChecksEstudiantil();
    this.checksEstudiantilModalSig.set(checks);

    const hayProblemas = checks.some((c) => !c.edadOk || !c.vigenciaOk);
    if (hayProblemas) {
      this.notify.aviso('Aún hay pendientes en la validación estudiantil.');
      return;
    }

    const next = this.nextAfterValidacionEstudiantil;
    this.nextAfterValidacionEstudiantil = null;
    this.mostrarModalEstudiantilSig.set(false);

    if (next) next();
  }

  estudiantilCheckDe(idSocio: number): EstudiantilCheck | null {
    const arr = this.checksEstudiantilVistaSig() ?? [];
    return arr.find((c) => Number(c.socioId) === Number(idSocio)) ?? null;
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

        if ((socio as any)?.idSocio) {
          const ya = this.miembrosSig().some((x: any) => Number(x?.idSocio) === Number((socio as any).idSocio));
          if (!ya) this.miembrosSig.set([socio as any, ...this.miembrosSig()]);
        }

        this.refrescarEstadosAsesoria();
        this.guardarDraft();
      },
      error: () => this.notify.error('No se pudo cargar el socio.'),
    });

    // Cargar paquetes (SIN filtrar activos)
    this.cargandoPaquetes = true;
    this.errorPaquetes = null;

    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        const normalizados = (lista ?? []).map((p: any) => ({
          ...p,
          idPaquete: Number(p?.idPaquete ?? 0),
          activo: p?.activo !== false,
        }));

        this.store.dispatch(
          ReinscripcionActions.setListaPaquetes({ paquetes: normalizados as any })
        );

        this.cargandoPaquetes = false;

        // ✅ Ya que tenemos lista, cargamos el paquete anterior
        this.cargarPaqueteAnteriorDelSocio(this.idSocio);
      },
      error: () => {
        this.errorPaquetes = 'No se pudieron cargar los paquetes.';
        this.cargandoPaquetes = false;
      },
    });
  }

  // =========================
  // Asesoría
  // =========================
  private refrescarEstadosAsesoria(): void {
    const miembros = this.miembrosSig() ?? [];
    if (!miembros.length) return;

    const ids = Array.from(new Set(miembros.map((m: any) => Number(m?.idSocio ?? 0)).filter((x) => x > 0)));
    if (!ids.length) return;

    this.cargandoEstadoAsesoriaSig.set(true);

    forkJoin(
      ids.map((id) =>
        this.asesoriaSrv.estado(id).pipe(
          catchError((err) => {
            console.error('Error estado asesoría', id, err);
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
    const anyS: any = s as any;
    return `${anyS.nombre ?? ''} ${anyS.apellido ?? ''}`.trim() || `ID ${anyS.idSocio ?? ''}`;
  }

  private validarAsesoriaAntesDeContinuar(next: () => void): void {
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

    forkJoin(
      miembros.map((m: any) =>
        this.asesoriaSrv.estado(Number(m?.idSocio)).pipe(
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
        const current = { ...(this.estadoAsesoriaBySocioIdSig() ?? {}) };
        for (let i = 0; i < miembros.length; i++) {
          const socio = miembros[i] as any;
          const dto = arr[i];

          if (dto?.asesorado) current[this.key(Number(socio.idSocio))] = dto;
          else delete current[this.key(Number(socio.idSocio))];
        }
        this.estadoAsesoriaBySocioIdSig.set(current);

        for (let i = 0; i < miembros.length; i++) {
          const socio = miembros[i] as any;
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

        next();
      });
  }

  // =========================
  // ✅ Paquete anterior auto
  // =========================
  private cargarPaqueteAnteriorDelSocio(idSocio: number): void {
    const socioId = Number(idSocio ?? 0);
    if (!socioId) return;

    this.membresiaSrv.buscarMembresiasPorSocio(socioId, 0, 50).subscribe({
      next: (page: any) => {
        const rows: any[] = page?.content ?? page?.items ?? page?.data ?? [];
        const ultima = this.pickMembresiaMasReciente(rows);
        const idPaquete = this.extraerIdPaquete(ultima);

        if (!idPaquete) {
          this.form.controls.paqueteId.enable({ emitEvent: false });
          this.paqueteBloqueadoSig.set(false);
          return;
        }

        const existe = (this.listaPaquetesSig() ?? []).some((p: any) => Number(p?.idPaquete) === Number(idPaquete));
        if (!existe) {
          this.form.controls.paqueteId.setValue(0, { emitEvent: false });
          this.form.controls.paqueteId.enable({ emitEvent: false });
          this.paqueteBloqueadoSig.set(false);
          return;
        }

        this.form.controls.paqueteId.setValue(Number(idPaquete), { emitEvent: true });
        this.form.controls.paqueteId.disable({ emitEvent: false });
        this.paqueteBloqueadoSig.set(true);

        // ✅ promo
        this.cargarPromoDePaquete(Number(idPaquete));

        // ✅ sincroniza texto del buscador
        this.syncPaqueteBusquedaConSeleccion();

        this.guardarDraft();
      },
      error: () => {
        this.form.controls.paqueteId.enable({ emitEvent: false });
        this.paqueteBloqueadoSig.set(false);
      },
    });
  }

  private extraerIdPaquete(m: any): number {
    const id = Number(
      m?.paquete?.idPaquete ??
      m?.paquete?.id ??
      m?.idPaquete ??
      m?.paqueteId ??
      0
    );
    return Number.isFinite(id) ? id : 0;
  }

  private pickMembresiaMasReciente(list: any[]): any | null {
    const arr = Array.isArray(list) ? list.filter((x) => x) : [];
    if (!arr.length) return null;

    return arr.reduce((best, cur) => {
      if (!best) return cur;

      const bf = String(best?.fechaFin ?? '');
      const cf = String(cur?.fechaFin ?? '');

      if (bf && cf) return cf > bf ? cur : best;

      const bid = Number(best?.idMembresia ?? best?.id ?? 0);
      const cid = Number(cur?.idMembresia ?? cur?.id ?? 0);
      return cid > bid ? cur : best;
    }, null as any);
  }

  desbloquearPaquete(): void {
    if (this.guardando) return;

    if (this.miembrosSig().length > 1) {
      this.notify.aviso('Quita integrantes extra antes de cambiar el paquete.');
      return;
    }

    this.form.controls.paqueteId.enable({ emitEvent: false });
    this.paqueteBloqueadoSig.set(false);

    // ✅ abre dropdown para facilitar cambio
    this.paqueteDropdownAbiertoSig.set(true);

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

    if (this.miembrosSig().some((m: any) => Number(m.idSocio) === id)) {
      this.notify.aviso('Ese socio ya está agregado.');
      return;
    }

    if (this.miembrosSig().length >= this.requeridoSig()) {
      this.notify.aviso('Ya completaste los integrantes requeridos.');
      return;
    }

    this.socioSrv.buscarPorId(id).subscribe({
      next: (s) => {
        if (!(s as any)?.idSocio) {
          this.notify.aviso('No se encontró el socio.');
          return;
        }

        this.miembrosSig.set([...this.miembrosSig(), s as any]);
        this.socioBuscarIdCtrl.setValue(0);

        this.refrescarEstadosAsesoria();

        this.guardarDraft();
        this.notify.exito('Socio agregado.');
      },
      error: () => this.notify.error('No se pudo cargar el socio por ID.'),
    });
  }

  quitarMiembro(idSocio: number): void {
    if (this.guardando) return;

    const principalId = Number((this.socioPrincipalSig() as any)?.idSocio ?? 0);
    if (Number(idSocio) === principalId) {
      this.notify.aviso('No puedes quitar al socio principal.');
      return;
    }

    const map = { ...(this.pagosBySocioIdSig() ?? {}) };
    delete map[this.key(idSocio)];
    this.pagosBySocioIdSig.set(map);

    this.miembrosSig.set(this.miembrosSig().filter((m: any) => Number(m.idSocio) !== Number(idSocio)));

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
        if (!(s as any)?.idSocio) {
          this.notify.aviso('No se encontró socio para esa huella.');
          return;
        }
        if (this.miembrosSig().some((m: any) => Number(m.idSocio) === Number((s as any).idSocio))) {
          this.notify.aviso('Ese socio ya está agregado.');
          return;
        }

        this.miembrosSig.set([...this.miembrosSig(), s as any]);

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

    const paquete = this.paqueteActualSig() as any;
    if (!paquete || paquete?.activo === false) {
      this.notify.aviso('Selecciona un paquete activo.');
      return;
    }

    if (this.esGrupalSig() && this.faltanIntegrantesSig() > 0) {
      this.mensajeError = `Faltan ${this.faltanIntegrantesSig()} integrante(s) para completar el paquete.`;
      return;
    }

    // ✅ 1) Validación estudiantil
    this.validarEstudiantilAntesDeContinuar(() => {
      // ✅ 2) Validación asesoría
      this.validarAsesoriaAntesDeContinuar(() => {
        const miembros = this.miembrosSig();
        const map = this.pagosBySocioIdSig();
        const idx = miembros.findIndex((m: any) => !map[this.key(m.idSocio!)]);
        this.cobrandoIndex.set(idx >= 0 ? idx : 0);

        this.mensajeError = null;
        this.mostrarResumen.set(true);
      });
    });
  }

  cerrarResumen(): void {
    this.mostrarResumen.set(false);
  }

  confirmarPago(pagos: PagoData[]): void {
    const socio: any = this.socioCobrandoSig() as any;
    const paquete: any = this.paqueteActualSig() as any;
    if (!socio?.idSocio || !paquete?.idPaquete) {
      this.notify.error('Falta socio o paquete.');
      return;
    }

    const total = this.totalConPromoSig() ?? 0;

    const suma = (pagos ?? []).reduce((a, p: any) => a + (Number(p?.monto) || 0), 0);
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
    const faltan = miembros.filter((m: any) => !this.pagosBySocioIdSig()[this.key(m.idSocio!)]).length;

    if (faltan > 0) {
      this.notify.exito(`Pago capturado. Faltan ${faltan} integrante(s) por cobrar.`);
      return;
    }

    this.validarEstudiantilAntesDeContinuar(() => {
      this.validarAsesoriaAntesDeContinuar(() => this.guardarTodo());
    });
  }

  private guardarTodo(): void {
    const paquete: any = this.paqueteActualSig() as any;
    if (!paquete?.idPaquete) {
      this.notify.error('Selecciona un paquete.');
      return;
    }

    const miembros: any[] = this.miembrosSig() as any[];
    if (!miembros.length) {
      this.notify.error('No hay socios seleccionados.');
      return;
    }

    const map = this.pagosBySocioIdSig();
    const sinPago = miembros.filter((m: any) => !(map[this.key(m.idSocio!)]?.length));
    if (sinPago.length) {
      this.notify.aviso('Faltan pagos por capturar para algunos integrantes.');
      return;
    }

    const descuentoTotal = this.descuentoTotalSig();

    const membresiasPayload = miembros.map((m: any) => ({
      socio: { idSocio: m.idSocio },
      paquete: { idPaquete: paquete.idPaquete },
      movimiento: 'REINSCRIPCION',
      fechaInicio: this.fechaInicioSelSig?.() ?? this.form.controls.fechaInicio.value ?? hoyISO(),
      descuento: descuentoTotal,
      pagos: map[this.key(m.idSocio!)] ?? [],
    }));

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
            this.imprimirTicket(r, socio, pagos, paquete, descuentoTotal);
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
        this.imprimirTicket(resp, socio, pagos, paquete, descuentoTotal);

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

  private imprimirTicket(resp: any, socio: SocioData, pagos: PagoData[], paquete: any, descuentoTotal: number): void {
    const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);

    const pagosDet = (pagos ?? [])
      .filter((p: any) => (Number(p?.monto) || 0) > 0)
      .map((p: any) => ({ metodo: p.tipoPago, monto: Number(p.monto) || 0 }));

    const folioTicket = resp?.folio;

    this.ticket.imprimirMembresiaDesdeContexto({
      ctx,
      folio: folioTicket,
      fecha: new Date(),
      socioNombre: `${(socio as any).nombre ?? ''} ${(socio as any).apellido ?? ''}`.trim(),
      paqueteNombre: resp?.paquete?.nombre ?? paquete?.nombre ?? null,
      precioPaquete: this.num(resp?.paquete?.precio ?? paquete?.precio ?? 0),
      descuento: this.num(resp?.descuento ?? descuentoTotal),
      costoInscripcion: 0,
      pagos: pagosDet,
      referencia: resp?.referencia,
    });
  }

  private limpiarTodo(): void {
    const principal: any = this.socioPrincipalSig() as any;

    this.miembrosSig.set(principal ? [principal] : []);
    this.pagosBySocioIdSig.set({});
    this.cobrandoIndex.set(0);

    this.estadoAsesoriaBySocioIdSig.set({});

    this.mostrarModalEstudiantilSig.set(false);
    this.nextAfterValidacionEstudiantil = null;

    // ✅ promo reset
    this.promocionAplicadaSig.set(null);
    this.promoErrorSig.set(null);

    // ✅ bloqueo reset
    this.paqueteBloqueadoSig.set(false);

    // ✅ buscador reset
    this.paqueteBusquedaSig.set('');
    this.paqueteDropdownAbiertoSig.set(false);

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
        miembrosIds: (this.miembrosSig() as any[]).map((m) => Number((m as any).idSocio ?? 0)).filter((x) => x > 0),
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
          next: (g) => (this.gym = g as any),
          error: () => (this.gym = null),
        });
      }
    } catch {
      /* noop */
    }
  }
}