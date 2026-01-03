import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';

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

// ✅ Para calcular la fecha fin del nuevo paquete
import { calcularFechaFin, hoyISO } from 'src/app/util/fechas-precios';
import { TiempoPlan } from 'src/app/util/enums/tiempo-plan';
import { HuellaModal, HuellaResultado } from '../../huella-modal/huella-modal';

// ✅ Huella

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

@Component({
  selector: 'app-reinscripcion-adelantada',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ResumenCompra,
    TiempoPlanLabelPipe,
    HuellaModal, // ✅
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

  // Ticket
  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt = inject(JwtHelperService);

  // Estado
  idSocio: number | null = null;
  socio = signal<SocioData | null>(null);
  vigente = signal<MembresiaData | null>(null);

  cargandoSocio = false;

  listaPaquetes = signal<PaqueteData[]>([]);
  cargandoPaquetes = true;
  errorPaquetes: string | null = null;

  mostrarResumen = signal(false);
  guardando = false;
  mensajeError: string | null = null;

  // Huella
  mostrarHuella = signal(false);

  // Contexto ticket
  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // ========= Signals reactivas =========
  paqueteIdSig = signal<number>(0);
  descuentoValueSig = signal<number>(0);
  fechaInicioSig = signal<string>(hoyISO()); // ✅ para recalcular fecha fin

  // Form buscar
  formBuscar = this.fb.group({
    idSocio: this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
  });

  // Form pago (fechaInicio solo visual)
  form = this.fb.group({
    paqueteId: this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento: this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>({ value: hoyISO(), disabled: true }),
    movimiento: this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION'),
  });

  // Derivados
  diasRestantesSig = computed(() => {
    const v = this.vigente();
    if (!v?.fechaFin) return null;
    return diffDays(hoyISO(), v.fechaFin);
  });

  fechaInicioNuevaSig = computed(() => {
    const v = this.vigente();
    if (!v?.fechaFin) return hoyISO();
    return addDaysIso(v.fechaFin, 1); // día siguiente al vencimiento
  });

  paqueteActualSig = computed(() => {
    const id = this.paqueteIdSig();
    return (this.listaPaquetes() ?? []).find(p => Number(p?.idPaquete) === id) ?? null;
  });

  precioPaqueteSig = computed(() => Number(this.paqueteActualSig()?.precio ?? 0));
  descuentoSig = computed(() => Number(this.descuentoValueSig() ?? 0));

  totalVistaSig = computed(() => {
    const total = this.precioPaqueteSig() - this.descuentoSig();
    return Math.max(0, Number(total.toFixed(2)));
  });

  // ✅ NUEVO: fecha de “pago” = fecha fin (vencimiento) del NUEVO paquete
  fechaFinNuevaIsoSig = computed(() => {
    const inicio = this.fechaInicioSig(); // ISO YYYY-MM-DD
    const tiempo = (this.paqueteActualSig()?.tiempo ?? null) as TiempoPlan | null;
    return calcularFechaFin(inicio, tiempo);
  });

  fechaFinNuevaDateSig = computed(() => parseLocalDate(this.fechaFinNuevaIsoSig()));

  ngOnInit(): void {
    this.cargarContextoDesdeToken();

    // Sync signals con form
    this.paqueteIdSig.set(Number(this.form.controls.paqueteId.value ?? 0));
    this.descuentoValueSig.set(Number(this.form.controls.descuento.value ?? 0));
    this.fechaInicioSig.set(String(this.form.controls.fechaInicio.value ?? hoyISO()));

    this.form.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.paqueteIdSig.set(Number(v ?? 0)));

    this.form.controls.descuento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.descuentoValueSig.set(Number(v ?? 0)));

    // Cargar paquetes
    this.cargandoPaquetes = true;
    this.errorPaquetes = null;
    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        const activos = (lista ?? []).filter((p: any) => p?.activo !== false);
        this.listaPaquetes.set(activos);
        this.cargandoPaquetes = false;

        // Validar paqueteId actual
        const initId = Number(this.form.controls.paqueteId.value ?? 0);
        const valido = activos.some((p: any) => Number(p.idPaquete) === initId) ? initId : 0;
        if (valido !== initId) {
          this.form.controls.paqueteId.setValue(valido, { emitEvent: true });
        } else {
          this.paqueteIdSig.set(valido);
        }
      },
      error: () => {
        this.errorPaquetes = 'No se pudieron cargar los paquetes.';
        this.cargandoPaquetes = false;
      },
    });

    // Si viene por ruta con :id (opcional)
    const idParam = Number(this.route.snapshot.paramMap.get('id'));
    if (idParam > 0) {
      this.formBuscar.controls.idSocio.setValue(idParam, { emitEvent: false });
      this.buscarSocio();
    }
  }

  // ===================== Buscar socio por ID =====================
  buscarSocio(): void {
    const id = Number(this.formBuscar.controls.idSocio.value ?? 0);
    if (id <= 0) {
      this.notify.aviso('Ingresa un idSocio válido.');
      return;
    }

    this.cargandoSocio = true;
    this.idSocio = id;
    this.socio.set(null);
    this.vigente.set(null);
    this.mensajeError = null;

    this.socioSrv.buscarPorId(id)
      .pipe(finalize(() => (this.cargandoSocio = false)))
      .subscribe({
        next: (s) => {
          this.socio.set(s ?? null);
          if (!s) {
            this.notify.aviso('Socio no encontrado.');
            return;
          }
          this.cargarVigente(id);
        },
        error: () => this.notify.error('No se pudo cargar el socio.'),
      });
  }

  private cargarVigente(idSocio: number): void {
    this.membresiaSrv.buscarMembresiasVigentesPorSocio(idSocio).subscribe({
      next: (list) => {
        const vigentes = (list ?? []).filter(m => !!m?.fechaFin);

        if (!vigentes.length) {
          this.vigente.set(null);

          const hoy = hoyISO();
          this.form.controls.fechaInicio.setValue(hoy, { emitEvent: false });
          this.fechaInicioSig.set(hoy);

          this.notify.aviso('Este socio no tiene membresía vigente. La reinscripción anticipada no aplica.');
          return;
        }

        const max = vigentes.reduce((acc, cur) => {
          if (!acc) return cur;
          return (cur.fechaFin > acc.fechaFin) ? cur : acc;
        }, null as any);

        this.vigente.set(max);

        // Inicio del nuevo paquete: día siguiente al vencimiento
        const inicio = addDaysIso(max.fechaFin, 1);
        this.form.controls.fechaInicio.setValue(inicio, { emitEvent: false });
        this.fechaInicioSig.set(inicio);
      },
      error: () => {
        this.vigente.set(null);
        this.notify.error('No se pudo consultar la membresía vigente.');
      }
    });
  }

  // ===================== Buscar socio por HUELLAS =====================
  abrirHuella(): void { this.mostrarHuella.set(true); }
  cerrarHuella(): void { this.mostrarHuella.set(false); }

  confirmarHuella(res: HuellaResultado): void {
    this.mostrarHuella.set(false);

    const base64 = res?.muestras?.[0] ?? '';
    if (!base64) {
      this.notify.aviso('No se recibió una muestra válida.');
      return;
    }

    this.buscarSocioPorHuella(base64);
  }

  private buscarSocioPorHuella(huellaBase64: string): void {
    this.cargandoSocio = true;
    this.socio.set(null);
    this.vigente.set(null);
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

          this.socio.set(s);
          this.idSocio = Number(s.idSocio);

          // Autocompleta el input
          this.formBuscar.controls.idSocio.setValue(Number(s.idSocio), { emitEvent: false });

          // Cargar vigente
          this.cargarVigente(Number(s.idSocio));
        },
        error: () => this.notify.error('No se pudo buscar el socio por huella.'),
      });
  }

  // ===================== Flujo pago =====================
  abrirResumen(): void {
    if (!this.idSocio || !this.socio()) {
      this.mensajeError = 'Primero busca y selecciona un socio.';
      return;
    }
    if (!this.vigente()) {
      this.mensajeError = 'No hay membresía vigente; la reinscripción anticipada no aplica.';
      return;
    }
    if ((this.form.controls.paqueteId.value ?? 0) <= 0) {
      this.form.markAllAsTouched();
      this.mensajeError = 'Selecciona un paquete para continuar.';
      return;
    }

    this.mensajeError = null;
    this.mostrarResumen.set(true);
  }

  cerrarResumen(): void { this.mostrarResumen.set(false); }

  confirmar(pagos: PagoData[]): void {
    const paquete = this.paqueteActualSig();
    if (!this.idSocio || !this.socio() || !this.vigente()) {
      this.notify.aviso('Falta socio o membresía vigente.');
      return;
    }
    if (!paquete || (paquete as any)?.activo === false) {
      this.notify.aviso('Selecciona un paquete activo.');
      return;
    }

    const total = this.totalVistaSig() ?? 0;
    const sumaPagos = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(total - sumaPagos) > 0.01) {
      this.notify.aviso('La suma de pagos no coincide con el total.');
      return;
    }

    const payload: Partial<MembresiaData> = {
      socio: { idSocio: this.idSocio } as any,
      paquete: { idPaquete: paquete.idPaquete } as any,
      movimiento: 'REINSCRIPCION',
      pagos,
      descuento: Number(this.form.controls.descuento.value ?? 0),
      // (opcional) si tu backend lo acepta/ignora:
      // fechaInicio: this.fechaInicioSig(),
      // fechaFin: this.fechaFinNuevaIsoSig(),
    };

    this.guardando = true;
    this.membresiaSrv.reinscripcionAnticipada(payload).subscribe({
      next: (resp: any) => {
        this.guardando = false;
        this.mostrarResumen.set(false);
        this.notify.exito('Reinscripción adelantada realizada correctamente.');

        // Ticket
        const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);
        const socioNombre = this.nombreCompleto();

        const pagosDet = (pagos ?? [])
          .filter(p => (Number(p.monto) || 0) > 0)
          .map(p => ({ metodo: p.tipoPago, monto: Number(p.monto) || 0 }));
        const folioTicket = resp?.folio
        this.ticket.imprimirMembresiaDesdeContexto({
          ctx,
          folio: folioTicket,
          fecha: new Date(),
          socioNombre,
          paqueteNombre: paquete?.nombre ?? null,
          precioPaquete: Number(paquete?.precio ?? 0),
          descuento: Number(this.form.controls.descuento.value ?? 0),
          costoInscripcion: 0,
          pagos: pagosDet,
          referencia: resp?.referencia,
        });

        this.router.navigate(['/pages/socio', this.idSocio, 'historial']);
      },
      error: (e) => {
        this.guardando = false;
        this.notify.error(e?.error?.message ?? 'No se pudo completar la reinscripción adelantada.');
      },
    });
  }

  nombreCompleto(): string {
    const s = this.socio();
    return s ? `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() : '';
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
      /* noop */
    }
  }
}
