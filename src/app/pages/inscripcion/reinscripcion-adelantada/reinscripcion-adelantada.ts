import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of, forkJoin } from 'rxjs';

import { ResumenCompra } from '../../resumen-compra/resumen-compra';
import { TiempoPlanLabelPipe } from 'src/app/util/tiempo-plan-label';

import { SocioService } from 'src/app/services/socio-service';
import { MembresiaService } from 'src/app/services/membresia-service';
import { PaqueteService } from 'src/app/services/paquete-service';
import { NotificacionService } from 'src/app/services/notificacion-service';

import { GimnasioService } from 'src/app/services/gimnasio-service';
import { TicketService, VentaContexto } from 'src/app/services/ticket-service';
import { JwtHelperService } from '@auth0/angular-jwt';

import { SocioData } from 'src/app/model/socio-data';
import { MembresiaData, PagoData } from 'src/app/model/membresia-data';
import { PaqueteData } from 'src/app/model/paquete-data';
import { GimnasioData } from 'src/app/model/gimnasio-data';

import { TipoMovimiento } from 'src/app/util/enums/tipo-movimiento';
import { crearContextoTicket } from 'src/app/util/ticket-contexto';
import { environment } from 'src/environments/environment';

import { calcularFechaFin, hoyISO as hoyISOUtil } from 'src/app/util/fechas-precios';
import { TiempoPlan } from 'src/app/util/enums/tiempo-plan';

import { HuellaModal, HuellaResultado } from '../../huella-modal/huella-modal';

// ✅ Asesoría Nutricional (nuevo endpoint estado)
import {
  AsesoriaNutricionalService,
  AsesoriaNutricionalEstadoDTO,
} from 'src/app/services/asesoria-nutricional-service';

// ===================== Helpers fechas ISO (local) =====================
function parseLocalDate(iso: string): Date {
  const [y, m, d] = (iso ?? '').split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDaysIso(iso: string, days: number): string {
  const dt = parseLocalDate(iso);
  dt.setDate(dt.getDate() + days);
  return formatLocalDate(dt);
}
function diffDays(aIso: string, bIso: string): number {
  const a = parseLocalDate(aIso);
  const b = parseLocalDate(bIso);
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ===================== Tipos =====================
type Modalidad = 'INDIVIDUAL' | 'DUO' | 'TRIO' | 'SQUAD';

type MiembroSlot = {
  socio: SocioData;
  vigente: MembresiaData | null;
  pagos: PagoData[] | null;
  cargando: boolean;
  error: string | null;
  principal: boolean;
};

@Component({
  selector: 'app-reinscripcion-adelantada',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ResumenCompra,
    TiempoPlanLabelPipe,
    HuellaModal,
  ],
  templateUrl: './reinscripcion-adelantada.html',
  styleUrl: './reinscripcion-adelantada.css',
})
export class ReinscripcionAdelantada implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private socioSrv = inject(SocioService);
  private membresiaSrv = inject(MembresiaService);
  private paqueteSrv = inject(PaqueteService);
  private notify = inject(NotificacionService);

  // ✅ Asesoría nutricional
  private asesoriaSrv = inject(AsesoriaNutricionalService);
  estadoAsesoriaBySocioIdSig = signal<Record<string, AsesoriaNutricionalEstadoDTO>>({});
  cargandoEstadoAsesoriaSig = signal(false);
  validandoAsesoriaSig = signal(false);

  // Ticket
  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt = inject(JwtHelperService);

  // Contexto ticket
  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // UI general
  cargandoSocio = false;
  cargandoPaquetes = true;
  errorPaquetes: string | null = null;

  guardando = false;
  mensajeError: string | null = null;

  mostrarModalHuella = signal(false);
  private modoHuellaSig = signal<'PRINCIPAL' | 'MIEMBRO'>('PRINCIPAL');

  mostrarResumen = signal(false);
  cobrandoIndexSig = signal<number>(0);

  todayDate = new Date();

  // Data
  listaPaquetesSig = signal<PaqueteData[]>([]);
  miembrosSig = signal<MiembroSlot[]>([]);

  // Bloqueo paquete
  paqueteBloqueadoSig = signal<boolean>(false);

  // Controls
  formBuscar = this.fb.group({
    idSocio: this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
  });

  miembroBuscarIdCtrl = this.fb.nonNullable.control<number>(0, [Validators.min(1)]);

  form = this.fb.group({
    paqueteId: this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento: this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>({ value: hoyISOUtil(), disabled: true }),
    movimiento: this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION'),
  });

  // ===================== Normalizadores =====================
  private hoyISO(): string {
    return hoyISOUtil();
  }

  private key(id: number | null | undefined): string {
    return String(id ?? '');
  }

  private normalizarModalidad(raw: any): Modalidad {
    const m = String(raw ?? 'INDIVIDUAL').toUpperCase();
    if (m === 'DUO') return 'DUO';
    if (m === 'TRIO') return 'TRIO';
    if (m === 'SQUAD') return 'SQUAD';
    return 'INDIVIDUAL';
  }

  private cantidadRequerida(modalidad: Modalidad): number {
    if (modalidad === 'DUO') return 2;
    if (modalidad === 'TRIO') return 3;
    if (modalidad === 'SQUAD') return 5;
    return 1;
  }

  private modalidadPaquete(p: PaqueteData | null): Modalidad {
    return this.normalizarModalidad((p as any)?.modalidad);
  }

  private modalidadVigenteDe(m: MembresiaData | null): Modalidad {
    return this.normalizarModalidad((m as any)?.paquete?.modalidad);
  }

  // ===================== Computeds =====================
  socioPrincipalSig = computed(() => this.miembrosSig()[0]?.socio ?? null);
  vigentePrincipalSig = computed(() => this.miembrosSig()[0]?.vigente ?? null);

  modalidadVigenteSig = computed<Modalidad>(() => this.modalidadVigenteDe(this.vigentePrincipalSig()));
  requeridoSig = computed(() => this.cantidadRequerida(this.modalidadVigenteSig()));
  esGrupalSig = computed(() => this.requeridoSig() > 1);

  paqueteActualSig = computed(() => {
    const id = Number(this.form.controls.paqueteId.value ?? 0);
    return (this.listaPaquetesSig() ?? []).find(p => Number(p?.idPaquete) === id) ?? null;
  });

  modalidadSeleccionadaSig = computed<Modalidad>(() => this.modalidadPaquete(this.paqueteActualSig()));

  // ✅ Regla: en adelantada NO se cambia modalidad (debe coincidir con la vigente)
  modalidadCompatibleSig = computed(() => {
    const principal = this.vigentePrincipalSig();
    if (!principal?.fechaFin) return false;
    return this.modalidadSeleccionadaSig() === this.modalidadVigenteSig();
  });

  paquetesPermitidosSig = computed(() => {
    const principal = this.vigentePrincipalSig();
    const all = this.listaPaquetesSig() ?? [];
    if (!principal?.fechaFin) return all;
    const mod = this.modalidadVigenteSig();
    return all.filter(p => this.modalidadPaquete(p) === mod);
  });

  diasRestantesPrincipalSig = computed(() => {
    const v = this.vigentePrincipalSig();
    if (!v?.fechaFin) return null;
    return diffDays(this.hoyISO(), v.fechaFin);
  });

  fechaInicioNuevaIsoSig = computed(() => {
    const v = this.vigentePrincipalSig();
    if (!v?.fechaFin) return this.hoyISO();
    return addDaysIso(v.fechaFin, 1);
  });

  fechaInicioNuevaDateSig = computed(() => parseLocalDate(this.fechaInicioNuevaIsoSig()));

  fechaFinNuevaIsoSig = computed(() => {
    const inicio = this.fechaInicioNuevaIsoSig();
    const tiempo = (this.paqueteActualSig()?.tiempo ?? null) as TiempoPlan | null;
    return calcularFechaFin(inicio, tiempo);
  });

  fechaFinNuevaDateSig = computed(() => parseLocalDate(this.fechaFinNuevaIsoSig()));

  precioPaqueteSig = computed(() => Number(this.paqueteActualSig()?.precio ?? 0));
  descuentoSig = computed(() => Number(this.form.controls.descuento.value ?? 0));

  totalPorSocioSig = computed(() => {
    const total = this.precioPaqueteSig() - this.descuentoSig();
    return Math.max(0, Number(total.toFixed(2)));
  });

  faltanIntegrantesSig = computed(() => {
    const req = this.requeridoSig();
    const have = this.miembrosSig().length;
    return Math.max(0, req - have);
  });

  faltanPagosSig = computed(() => {
    return (this.miembrosSig() ?? []).filter(m => !(m.pagos?.length)).length;
  });

  // =====================
  // ✅ BLOQUEOS SEPARADOS (FIX)
  // =====================
  bloqueoAntesDeCobrarSig = computed(() => {
    const principal = this.vigentePrincipalSig();
    if (!principal?.fechaFin) return 'Primero busca un socio con membresía vigente.';
    if (!this.paqueteActualSig()) return 'Selecciona un paquete.';
    if (!this.modalidadCompatibleSig()) {
      return `No puedes cambiar de modalidad en reinscripción adelantada. Modalidad vigente: ${this.modalidadVigenteSig()}.`;
    }
    if (this.esGrupalSig() && this.faltanIntegrantesSig() > 0) {
      return `Faltan ${this.faltanIntegrantesSig()} integrante(s) para completar el paquete ${this.modalidadVigenteSig()}.`;
    }

    const principalFin = this.vigentePrincipalSig()?.fechaFin ?? null;
    const mod = this.modalidadVigenteSig();
    const slots = this.miembrosSig();

    for (const s of slots) {
      if (!s.vigente?.fechaFin) return 'Hay integrantes sin membresía vigente.';
      const m = this.modalidadVigenteDe(s.vigente);
      if (m !== mod) return 'Hay integrantes con modalidad distinta a la del socio principal.';
      if (principalFin && s.vigente.fechaFin !== principalFin) {
        return 'Para adelantada grupal, todos deben vencer el mismo día (fechaFin).';
      }
    }

    return null;
  });

  bloqueoAntesDeGuardarSig = computed(() => {
    const bloqueCobro = this.bloqueoAntesDeCobrarSig();
    if (bloqueCobro) return bloqueCobro;

    const slots = this.miembrosSig();
    for (const s of slots) {
      if (!s.pagos?.length) return 'Faltan pagos por capturar para algunos integrantes.';
    }
    return null;
  });

  // Cobro actual
  socioCobrandoSig = computed(() => {
    const idx = this.cobrandoIndexSig();
    return this.miembrosSig()[idx] ?? null;
  });

  socioCobrandoNombreSig = computed(() => {
    const slot = this.socioCobrandoSig();
    if (!slot?.socio) return '';
    return `${slot.socio.nombre ?? ''} ${slot.socio.apellido ?? ''}`.trim();
  });

  conceptoResumenSig = computed(() => {
    const paquete = this.paqueteActualSig();
    const nombre = paquete?.nombre ?? 'Paquete';

    if (!this.esGrupalSig()) return nombre;

    const idx = this.cobrandoIndexSig() + 1;
    const req = this.requeridoSig();
    return `${nombre} · Integrante ${idx} de ${req}`;
  });

  // ===================== Asesoría: reglas/estado =====================
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

  estadoAsesoriaDe(idSocio: number): AsesoriaNutricionalEstadoDTO | null {
    const map = this.estadoAsesoriaBySocioIdSig() ?? {};
    return map[this.key(idSocio)] ?? null;
  }

  private refrescarEstadosAsesoria(): void {
    const slots = this.miembrosSig() ?? [];
    if (!slots.length) return;

    const ids = Array.from(
      new Set(slots.map(s => Number(s.socio?.idSocio ?? 0)).filter(x => x > 0))
    );
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
          const dto = arr[i] as AsesoriaNutricionalEstadoDTO | null;
          // ✅ Si NO tiene asesoría -> no guardamos nada (no se muestra)
          if (dto && dto.asesorado) map[this.key(ids[i])] = dto;
        }
        this.estadoAsesoriaBySocioIdSig.set(map);
      });
  }

  private validarAsesoriaAntesDeContinuar(next: () => void): void {
    if (!this.requiereValidarAsesoriaNutricional()) {
      next();
      return;
    }

    const slots = this.miembrosSig() ?? [];
    if (!slots.length) {
      this.mensajeError = 'No hay socios seleccionados.';
      return;
    }

    this.validandoAsesoriaSig.set(true);
    this.mensajeError = null;

    const ids = slots.map(s => Number(s.socio?.idSocio ?? 0));

    forkJoin(
      ids.map((id) =>
        this.asesoriaSrv.estado(id).pipe(
          catchError((err) => {
            console.error('Error validando asesoría', id, err);
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
        // refresca cache UI (solo asesorados)
        const map: Record<string, AsesoriaNutricionalEstadoDTO> = { ...(this.estadoAsesoriaBySocioIdSig() ?? {}) };
        for (let i = 0; i < ids.length; i++) {
          const dto = arr[i];
          if (dto?.asesorado) map[this.key(ids[i])] = dto;
          else delete map[this.key(ids[i])];
        }
        this.estadoAsesoriaBySocioIdSig.set(map);

        // valida bloqueo
        for (let i = 0; i < slots.length; i++) {
          const socio = slots[i].socio;
          const dto = arr[i];

          const nombre = `${socio?.nombre ?? ''} ${socio?.apellido ?? ''}`.trim() || `ID ${socio?.idSocio ?? ''}`;

          if (!dto?.asesorado) {
            this.mensajeError = `El socio "${nombre}" no tiene asesoría nutricional registrada con Roberto. No se puede continuar.`;
            return;
          }
          if (!dto?.vigente) {
            const finTxt = dto?.fechaFin ? ` (Vigencia: ${dto.fechaFin})` : '';
            this.mensajeError = `La asesoría nutricional de "${nombre}" no está vigente (${dto?.estado ?? 'NO_VIGENTE'})${finTxt}. No se puede continuar.`;
            return;
          }
        }

        next();
      });
  }

  // ===================== Lifecycle =====================
  ngOnInit(): void {
    this.cargarContextoDesdeToken();

    this.form.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.enforceModalidadSeleccionada();
        this.limpiarPagos();
        // ✅ al cambiar paquete, si es de asesoría, puede cambiar visibilidad/validación
        this.refrescarEstadosAsesoria();
      });

    this.form.controls.descuento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.limpiarPagos());

    // Cargar paquetes
    this.cargandoPaquetes = true;
    this.errorPaquetes = null;
    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        const activos = (lista ?? []).filter((p: any) => p?.activo !== false);
        this.listaPaquetesSig.set(activos);
        this.cargandoPaquetes = false;
      },
      error: () => {
        this.errorPaquetes = 'No se pudieron cargar los paquetes.';
        this.cargandoPaquetes = false;
      },
    });

    const idParam = Number(this.route.snapshot.paramMap.get('id'));
    if (idParam > 0) {
      this.formBuscar.controls.idSocio.setValue(idParam, { emitEvent: false });
      this.buscarPrincipalPorId();
    }
  }

  // ===================== Principal (ID/Huella) =====================
  buscarPrincipalPorId(): void {
    const id = Number(this.formBuscar.controls.idSocio.value ?? 0);
    if (id <= 0) {
      this.notify.aviso('Ingresa un idSocio válido.');
      return;
    }

    this.cargandoSocio = true;
    this.mensajeError = null;

    this.socioSrv.buscarPorId(id)
      .pipe(finalize(() => (this.cargandoSocio = false)))
      .subscribe({
        next: (s) => {
          if (!s?.idSocio) {
            this.notify.aviso('Socio no encontrado.');
            this.resetFlujo();
            return;
          }
          this.setPrincipal(s);
        },
        error: () => this.notify.error('No se pudo cargar el socio.'),
      });
  }

  abrirHuellaPrincipal(): void {
    this.modoHuellaSig.set('PRINCIPAL');
    this.mostrarModalHuella.set(true);
  }

  abrirHuellaMiembro(): void {
    this.modoHuellaSig.set('MIEMBRO');
    this.mostrarModalHuella.set(true);
  }

  cerrarHuella(): void {
    this.mostrarModalHuella.set(false);
  }

  confirmarHuella(res: HuellaResultado): void {
    this.mostrarModalHuella.set(false);

    const base64 = res?.muestras?.[0] ?? '';
    if (!base64) {
      this.notify.aviso('No se recibió una muestra válida.');
      return;
    }

    const modo = this.modoHuellaSig();
    if (modo === 'PRINCIPAL') this.buscarPrincipalPorHuella(base64);
    else this.agregarMiembroPorHuella(base64);
  }

  private buscarPrincipalPorHuella(huellaBase64: string): void {
    this.cargandoSocio = true;
    this.mensajeError = null;

    this.socioSrv.buscarPorHuella(huellaBase64)
      .pipe(
        catchError(err => {
          if (err?.status === 403 || err?.status === 404) return of(null);
          throw err;
        }),
        finalize(() => (this.cargandoSocio = false))
      )
      .subscribe({
        next: (s) => {
          if (!s?.idSocio) {
            this.notify.error('Huella no encontrada o no pertenece a tu gimnasio.');
            return;
          }
          this.formBuscar.controls.idSocio.setValue(Number(s.idSocio), { emitEvent: false });
          this.setPrincipal(s);
        },
        error: () => this.notify.error('No se pudo buscar el socio por huella.'),
      });
  }

  private setPrincipal(s: SocioData): void {
    this.miembrosSig.set([{
      socio: s,
      vigente: null,
      pagos: null,
      cargando: true,
      error: null,
      principal: true,
    }]);

    // ✅ resetea asesorías (UI limpia si no hay)
    this.estadoAsesoriaBySocioIdSig.set({});

    this.form.controls.descuento.setValue(0, { emitEvent: false });
    this.form.controls.fechaInicio.setValue(this.hoyISO(), { emitEvent: false });
    this.form.controls.paqueteId.setValue(0, { emitEvent: false });
    this.paqueteBloqueadoSig.set(false);
    this.form.controls.paqueteId.enable({ emitEvent: false });

    this.cargarVigenteParaSlot(0, Number(s.idSocio));

    // ✅ carga estado asesoría del principal (solo si existe se mostrará)
    this.refrescarEstadosAsesoria();
  }

  private resetFlujo(): void {
    this.miembrosSig.set([]);
    this.form.controls.descuento.setValue(0, { emitEvent: false });
    this.form.controls.paqueteId.setValue(0, { emitEvent: false });
    this.form.controls.paqueteId.enable({ emitEvent: false });
    this.paqueteBloqueadoSig.set(false);
    this.mensajeError = null;
    this.mostrarResumen.set(false);
    this.cobrandoIndexSig.set(0);

    // ✅ limpia asesorías
    this.estadoAsesoriaBySocioIdSig.set({});
  }

  // ===================== Vigente por socio =====================
  private cargarVigenteParaSlot(index: number, idSocio: number): void {
    this.setSlot(index, { cargando: true, error: null });

    this.membresiaSrv.buscarMembresiasVigentesPorSocio(idSocio).subscribe({
      next: (list) => {
        const vigentes = (list ?? []).filter(m => !!m?.fechaFin);
        if (!vigentes.length) {
          if (index === 0) {
            this.setSlot(0, { cargando: false, vigente: null, error: 'No tiene membresía vigente. Adelantada no aplica.' });
            this.notify.aviso('Este socio no tiene membresía vigente. La reinscripción adelantada no aplica.');
            return;
          }

          this.notify.aviso('El integrante no tiene membresía vigente. No se puede usar en adelantada grupal.');
          this.quitarMiembroByIndex(index);
          return;
        }

        const max = vigentes.reduce((acc, cur) => {
          if (!acc) return cur;
          return (cur.fechaFin > acc.fechaFin) ? cur : acc;
        }, null as any);

        this.setSlot(index, { cargando: false, vigente: max, error: null });

        if (index === 0) {
          const inicio = addDaysIso(max.fechaFin, 1);
          this.form.controls.fechaInicio.setValue(inicio, { emitEvent: false });

          const idPaqueteVigente = Number((max as any)?.paquete?.idPaquete ?? 0);
          const existe = (this.listaPaquetesSig() ?? []).some(p => Number(p.idPaquete) === idPaqueteVigente);

          if (existe && idPaqueteVigente > 0) {
            this.form.controls.paqueteId.setValue(idPaqueteVigente, { emitEvent: true });
            this.form.controls.paqueteId.disable({ emitEvent: false });
            this.paqueteBloqueadoSig.set(true);
          } else {
            this.form.controls.paqueteId.enable({ emitEvent: false });
            this.paqueteBloqueadoSig.set(false);
          }

          const req = this.requeridoSig();
          const current = this.miembrosSig();
          this.miembrosSig.set(current.slice(0, Math.min(1, req)));

          this.enforceModalidadSeleccionada();

          // ✅ refrescar asesorías al cambiar principal/modalidad
          this.refrescarEstadosAsesoria();
        }

        if (index > 0) {
          const principalV = this.vigentePrincipalSig();
          if (!principalV?.fechaFin) return;

          const modPrincipal = this.modalidadVigenteSig();
          const modMiembro = this.modalidadVigenteDe(max);

          if (modMiembro !== modPrincipal) {
            this.notify.aviso(`Ese socio tiene modalidad ${modMiembro}. Debe coincidir con ${modPrincipal}.`);
            this.quitarMiembroByIndex(index);
            return;
          }

          if (max.fechaFin !== principalV.fechaFin) {
            this.notify.aviso('Para adelantada grupal, todos deben vencer el mismo día (fechaFin).');
            this.quitarMiembroByIndex(index);
            return;
          }

          // ✅ refrescar asesorías (para mostrar badge si aplica)
          this.refrescarEstadosAsesoria();
        }
      },
      error: () => {
        if (index === 0) {
          this.setSlot(0, { cargando: false, vigente: null, error: 'No se pudo consultar la membresía vigente.' });
          this.notify.error('No se pudo consultar la membresía vigente.');
          return;
        }
        this.notify.error('No se pudo consultar la membresía vigente del integrante.');
        this.quitarMiembroByIndex(index);
      }
    });
  }

  private setSlot(index: number, patch: Partial<MiembroSlot>): void {
    const arr = [...(this.miembrosSig() ?? [])];
    const old = arr[index];
    if (!old) return;
    arr[index] = { ...old, ...patch };
    this.miembrosSig.set(arr);
  }

  // ===================== Paquete: bloqueo / modalidad =====================
  desbloquearPaquete(): void {
    if (this.guardando) return;

    if ((this.miembrosSig()?.length ?? 0) > 1) {
      this.notify.aviso('Quita integrantes extra antes de cambiar el paquete.');
      return;
    }

    this.form.controls.paqueteId.enable({ emitEvent: false });
    this.paqueteBloqueadoSig.set(false);
    this.notify.aviso('Paquete desbloqueado (solo misma modalidad).');
  }

  private enforceModalidadSeleccionada(): void {
    const principal = this.vigentePrincipalSig();
    if (!principal?.fechaFin) return;

    const pid = Number(this.form.controls.paqueteId.value ?? 0);
    if (!pid) return;

    const p = this.paqueteActualSig();
    if (!p) return;

    const modSel = this.modalidadSeleccionadaSig();
    const modVig = this.modalidadVigenteSig();

    if (modSel !== modVig) {
      this.notify.aviso(`No puedes cambiar de modalidad en adelantada. Debe ser ${modVig}.`);
      const vigenteId = Number((principal as any)?.paquete?.idPaquete ?? 0);
      const existe = (this.listaPaquetesSig() ?? []).some(x => Number(x.idPaquete) === vigenteId);

      const fallback = existe ? vigenteId : 0;
      this.form.controls.paqueteId.setValue(fallback, { emitEvent: false });
    }
  }

  // ===================== Integrantes (solo grupal) =====================
  agregarMiembroPorId(): void {
    if (this.guardando) return;

    if (!this.esGrupalSig()) {
      this.notify.aviso('El socio principal no tiene modalidad grupal.');
      return;
    }

    if (this.faltanIntegrantesSig() <= 0) {
      this.notify.aviso('Ya completaste los integrantes requeridos.');
      return;
    }

    const id = Number(this.miembroBuscarIdCtrl.value ?? 0);
    if (!id || id <= 0) {
      this.notify.aviso('Ingresa un ID válido.');
      return;
    }

    if (this.miembrosSig().some(m => Number(m.socio?.idSocio) === Number(id))) {
      this.notify.aviso('Ese socio ya está agregado.');
      return;
    }

    this.socioSrv.buscarPorId(id).subscribe({
      next: (s) => {
        if (!s?.idSocio) {
          this.notify.aviso('No se encontró el socio.');
          return;
        }

        const arr = [...this.miembrosSig()];
        arr.push({
          socio: s,
          vigente: null,
          pagos: null,
          cargando: true,
          error: null,
          principal: false,
        });
        this.miembrosSig.set(arr);

        this.miembroBuscarIdCtrl.setValue(0, { emitEvent: false });
        this.limpiarPagos();

        this.cargarVigenteParaSlot(arr.length - 1, Number(s.idSocio));
      },
      error: () => this.notify.error('No se pudo cargar el socio por ID.'),
    });
  }

  private agregarMiembroPorHuella(huellaBase64: string): void {
    if (this.guardando) return;

    if (!this.esGrupalSig()) {
      this.notify.aviso('El socio principal no tiene modalidad grupal.');
      return;
    }

    if (this.faltanIntegrantesSig() <= 0) {
      this.notify.aviso('Ya completaste los integrantes requeridos.');
      return;
    }

    this.socioSrv.buscarPorHuella(huellaBase64)
      .pipe(
        catchError(err => {
          if (err?.status === 403 || err?.status === 404) return of(null);
          throw err;
        })
      )
      .subscribe({
        next: (s: any) => {
          if (!s?.idSocio) {
            this.notify.aviso('No se encontró socio para esa huella.');
            return;
          }
          if (this.miembrosSig().some(m => Number(m.socio?.idSocio) === Number(s.idSocio))) {
            this.notify.aviso('Ese socio ya está agregado.');
            return;
          }

          const arr = [...this.miembrosSig()];
          arr.push({
            socio: s,
            vigente: null,
            pagos: null,
            cargando: true,
            error: null,
            principal: false,
          });
          this.miembrosSig.set(arr);

          this.limpiarPagos();
          this.cargarVigenteParaSlot(arr.length - 1, Number(s.idSocio));
        },
        error: () => this.notify.error('No se pudo buscar socio por huella.'),
      });
  }

  quitarMiembro(idSocio: number): void {
    if (this.guardando) return;

    const principalId = Number(this.socioPrincipalSig()?.idSocio ?? 0);
    if (Number(idSocio) === principalId) {
      this.notify.aviso('No puedes quitar al socio principal.');
      return;
    }

    this.miembrosSig.set(this.miembrosSig().filter(m => Number(m.socio?.idSocio) !== Number(idSocio)));

    // ✅ borra estado asesoría (para que no quede “fantasma”)
    const map = { ...(this.estadoAsesoriaBySocioIdSig() ?? {}) };
    delete map[this.key(idSocio)];
    this.estadoAsesoriaBySocioIdSig.set(map);

    const idx = this.cobrandoIndexSig();
    if (idx >= this.miembrosSig().length) {
      this.cobrandoIndexSig.set(Math.max(0, this.miembrosSig().length - 1));
    }

    this.limpiarPagos();
  }

  private quitarMiembroByIndex(index: number): void {
    const arr = [...this.miembrosSig()];
    if (index <= 0 || index >= arr.length) return;

    const idSocio = Number(arr[index]?.socio?.idSocio ?? 0);
    arr.splice(index, 1);
    this.miembrosSig.set(arr);

    if (idSocio > 0) {
      const map = { ...(this.estadoAsesoriaBySocioIdSig() ?? {}) };
      delete map[this.key(idSocio)];
      this.estadoAsesoriaBySocioIdSig.set(map);
    }

    const idx = this.cobrandoIndexSig();
    if (idx >= arr.length) {
      this.cobrandoIndexSig.set(Math.max(0, arr.length - 1));
    }

    this.limpiarPagos();
  }

  private limpiarPagos(): void {
    const arr = this.miembrosSig().map(m => ({ ...m, pagos: null }));
    this.miembrosSig.set(arr);
  }

  // ===================== Fechas por integrante =====================
  inicioNuevoIso(slot: MiembroSlot): string | null {
    const fin = slot?.vigente?.fechaFin;
    if (!fin) return null;
    return addDaysIso(fin, 1);
  }

  finNuevoIso(slot: MiembroSlot): string | null {
    const inicio = this.inicioNuevoIso(slot);
    const tiempo = (this.paqueteActualSig()?.tiempo ?? null) as TiempoPlan | null;
    if (!inicio || !tiempo) return null;
    return calcularFechaFin(inicio, tiempo);
  }

  finNuevoDate(slot: MiembroSlot): Date | null {
    const iso = this.finNuevoIso(slot);
    return iso ? parseLocalDate(iso) : null;
  }

  // ===================== Cobro =====================
  abrirResumen(): void {
    if (this.guardando) return;

    const bloque = this.bloqueoAntesDeCobrarSig();
    if (bloque) {
      this.mensajeError = bloque;
      return;
    }

    // ✅ Validación asesoría (solo si aplica)
    this.validarAsesoriaAntesDeContinuar(() => {
      const miembros = this.miembrosSig();
      const idx = miembros.findIndex(m => !(m.pagos?.length));
      this.cobrandoIndexSig.set(idx >= 0 ? idx : 0);

      this.mensajeError = null;
      this.mostrarResumen.set(true);
    });
  }

  abrirResumenParaIndex(index: number): void {
    if (this.guardando) return;

    const bloque = this.bloqueoAntesDeCobrarSig();
    if (bloque) {
      this.mensajeError = bloque;
      return;
    }

    const slots = this.miembrosSig();
    if (index < 0 || index >= slots.length) return;

    // ✅ Validación asesoría (solo si aplica)
    this.validarAsesoriaAntesDeContinuar(() => {
      this.cobrandoIndexSig.set(index);
      this.mensajeError = null;
      this.mostrarResumen.set(true);
    });
  }

  cerrarResumen(): void {
    this.mostrarResumen.set(false);
  }

  confirmarPago(pagos: PagoData[]): void {
    const slot = this.socioCobrandoSig();
    if (!slot?.socio?.idSocio) {
      this.notify.error('Falta socio.');
      return;
    }

    const total = this.totalPorSocioSig() ?? 0;
    const suma = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(total - suma) > 0.01) {
      this.notify.aviso('La suma de pagos no coincide con el total.');
      return;
    }

    const idx = this.cobrandoIndexSig();
    this.setSlot(idx, { pagos: pagos ?? [] });

    this.mostrarResumen.set(false);

    const faltanPagos = this.miembrosSig().filter(m => !(m.pagos?.length)).length;
    if (faltanPagos > 0) {
      this.notify.exito(`Pago capturado. Faltan ${faltanPagos} integrante(s) por cobrar.`);
      return;
    }

    this.guardarTodo();
  }

  // ===================== Guardar =====================
  private guardarTodo(): void {
    const bloque = this.bloqueoAntesDeGuardarSig();
    if (bloque) {
      this.notify.aviso(bloque);
      return;
    }

    // ✅ Validación asesoría (solo si aplica) antes de persistir
    this.validarAsesoriaAntesDeContinuar(() => this.persistir());
  }

  private persistir(): void {
    const paquete = this.paqueteActualSig();
    if (!paquete?.idPaquete) {
      this.notify.error('Selecciona un paquete.');
      return;
    }

    const miembros = this.miembrosSig();
    const descuento = Number(this.form.controls.descuento.value ?? 0);

    const payloads = miembros.map(m => ({
      socio: { idSocio: m.socio.idSocio },
      paquete: { idPaquete: paquete.idPaquete },
      movimiento: 'REINSCRIPCION',
      descuento,
      pagos: m.pagos ?? [],
    }));

    this.guardando = true;

    const esBatch = this.esGrupalSig();
    if (esBatch) {
      this.membresiaSrv.reinscripcionAnticipadaBatch(payloads as any[])
        .pipe(finalize(() => (this.guardando = false)))
        .subscribe({
          next: (respArr: any[]) => {
            const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);

            const lista = Array.isArray(respArr) ? respArr : [];
            for (let i = 0; i < miembros.length; i++) {
              const r = lista[i] ?? {};
              this.imprimirTicket(ctx, r, miembros[i].socio, miembros[i].pagos ?? [], paquete, descuento);
            }

            this.notify.exito('Reinscripción adelantada grupal guardada.');
            const principalId = Number(this.socioPrincipalSig()?.idSocio ?? 0);
            if (principalId > 0) this.router.navigate(['/pages/socio', principalId, 'historial']);
          },
          error: (e) => {
            const msg = e?.error?.detail || e?.error?.message || e?.error?.title || 'No se pudo guardar la adelantada grupal.';
            this.notify.error(msg);
          },
        });
      return;
    }

    this.membresiaSrv.reinscripcionAnticipada(payloads[0] as any)
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (resp: any) => {
          const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);
          const socio = miembros[0].socio;
          const pagos = miembros[0].pagos ?? [];
          this.imprimirTicket(ctx, resp, socio, pagos, paquete, descuento);

          this.notify.exito('Reinscripción adelantada guardada.');
          const principalId = Number(this.socioPrincipalSig()?.idSocio ?? 0);
          if (principalId > 0) this.router.navigate(['/pages/socio', principalId, 'historial']);
        },
        error: (e) => {
          const msg = e?.error?.detail || e?.error?.message || e?.error?.title || 'No se pudo completar la reinscripción adelantada.';
          this.notify.error(msg);
        },
      });
  }

  private imprimirTicket(
    ctx: VentaContexto,
    resp: any,
    socio: SocioData,
    pagos: PagoData[],
    paquete: PaqueteData,
    descuento: number
  ): void {
    const pagosDet = (pagos ?? [])
      .filter(p => (Number(p.monto) || 0) > 0)
      .map(p => ({ metodo: p.tipoPago, monto: Number(p.monto) || 0 }));

    const folioTicket = resp?.folio;

    this.ticket.imprimirMembresiaDesdeContexto({
      ctx,
      folio: folioTicket,
      fecha: new Date(),
      socioNombre: `${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim(),
      paqueteNombre: resp?.paquete?.nombre ?? paquete?.nombre ?? null,
      precioPaquete: Number(resp?.paquete?.precio ?? paquete?.precio ?? 0),
      descuento: Number(resp?.descuento ?? descuento ?? 0),
      costoInscripcion: 0,
      pagos: pagosDet,
      referencia: resp?.referencia,
    });
  }

  // ===================== Helpers =====================
  nombreCompleto(s: SocioData | null): string {
    return s ? `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() : '';
  }

  // ===================== Token / gym =====================
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
