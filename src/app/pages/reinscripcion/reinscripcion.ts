import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SocioService } from '../../services/socio-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';
import { PaqueteService } from '../../services/paquete-service';

import { SocioData } from '../../model/socio-data';
import { MembresiaData, PagoData } from '../../model/membresia-data';

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

// NgRx (sin effects)
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

@Component({
  selector: 'app-reinscripcion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ResumenCompra,
    TiempoPlanLabelPipe,
  ],
  templateUrl: './reinscripcion.html',
  styleUrl: './reinscripcion.css',
})
export class Reinscripcion implements OnInit {
  // Inyección
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private socioSrv = inject(SocioService);
  private membresiaSrv = inject(MembresiaService);
  private paqueteSrv = inject(PaqueteService);
  private notify = inject(NotificacionService);

  // Ticket
  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt = inject(JwtHelperService);

  // Store
  private store = inject(Store);

  // Estado UI
  idSocio!: number;
  socio = signal<SocioData | null>(null);
  mostrarResumen = signal(false);
  guardando = false;
  mensajeError: string | null = null;
  cargandoPaquetes = true;
  errorPaquetes: string | null = null;

  // Contexto ticket
  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // Form
  form = this.fb.group({
    paqueteId: this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento: this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>(hoyISO()),
    movimiento: this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION'),
  });

  // Signals del store
  listaPaquetesSig = this.store.selectSignal(selectListaPaquetes);
  paqueteActualSig = this.store.selectSignal(selectPaqueteActual);
  precioPaqueteSig = this.store.selectSignal(selectPrecioPaquete);
  totalVistaSig = this.store.selectSignal(selectTotalVista);
  totalSinDescSig = this.store.selectSignal(selectTotalSinDescuento);
  fechaPagoVistaSig = this.store.selectSignal(selectFechaPagoVista);
  descuentoSelSig = this.store.selectSignal(selectDescuento);
  fechaInicioSelSig = this.store.selectSignal(selectFechaInicio);
  paqueteIdSelSig = this.store.selectSignal(selectPaqueteId);

  ngOnInit(): void {
    this.cargarContextoDesdeToken();

    // id de ruta
    this.idSocio = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.idSocio) {
      this.notify.error('Falta el id del socio.');
      this.router.navigate(['/pages/socio']);
      return;
    }

    // cargar socio
    this.socioSrv.buscarPorId(this.idSocio).subscribe({
      next: (s) => this.socio.set(s ?? null),
      error: () => this.notify.error('No se pudo cargar el socio.'),
    });

    // cargar paquetes (HTTP aquí y luego al store)
    this.cargandoPaquetes = true;
    this.errorPaquetes = null;
    this.paqueteSrv.buscarTodos().subscribe({
      next: (lista) => {
        // Solo activos (si falta el campo, se asume activo)
        const activos = (lista ?? []).filter((p) => p?.activo !== false);

        // Mandar al store solo los activos
        this.store.dispatch(
          ReinscripcionActions.setListaPaquetes({ paquetes: activos })
        );
        this.cargandoPaquetes = false;

        // Validar paqueteId inicial
        const initId = Number(this.form.controls.paqueteId.value ?? 0);
        const valido = activos.some((p) => Number(p.idPaquete) === initId)
          ? initId
          : 0;

        if (valido !== initId) {
          this.form.controls.paqueteId.setValue(valido, { emitEvent: false });
        }
        this.store.dispatch(
          ReinscripcionActions.setPaqueteId({ paqueteId: valido })
        );
      },
      error: () => {
        this.errorPaquetes = 'No se pudieron cargar los paquetes.';
        this.cargandoPaquetes = false;
      },
    });
  }

  // form -> store
  constructor() {
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
          ReinscripcionActions.setFechaInicio({
            fechaInicio: String(f ?? hoyISO()),
          })
        )
      );
  }

  abrirResumen(): void {
    if ((this.form.controls.paqueteId.value ?? 0) <= 0) {
      this.form.markAllAsTouched();
      this.mensajeError = 'Selecciona un paquete para continuar.';
      return;
    }
    this.mensajeError = null;
    this.mostrarResumen.set(true);
  }
  cerrarResumen(): void {
    this.mostrarResumen.set(false);
  }

  // Confirmar reinscripción
  confirmar(pagos: PagoData[]): void {
    const paquete = this.paqueteActualSig();

    // Guardia extra por si algo llegó inactivo / no válido:
    if (!paquete || (paquete as any)?.activo === false) {
      this.notify.aviso('Selecciona un paquete activo.');
      return;
    }

    // Validar suma de pagos = total
    const total = this.totalVistaSig() ?? 0;
    const sumaPagos = (pagos ?? []).reduce(
      (a, p) => a + (Number(p.monto) || 0),
      0
    );
    if (Math.abs(total - sumaPagos) > 0.01) {
      this.notify.aviso('La suma de pagos no coincide con el total.');
      return;
    }

    const payload: Partial<MembresiaData> = {
      socio: { idSocio: this.idSocio } as any,
      paquete: { idPaquete: paquete.idPaquete } as any,
      movimiento: this.form.controls.movimiento.value!, // 'REINSCRIPCION'
      pagos, // 👈 pagos mixtos
      descuento: this.descuentoSelSig() ?? 0,
    };

    this.guardando = true;
    this.membresiaSrv.guardar(payload as any).subscribe({
      next: (resp: any) => {
        this.guardando = false;
        this.mostrarResumen.set(false);
        this.notify.exito('Reinscripción realizada correctamente.');

        // 👉 Activar socio si estaba inactivo
        this.activarSocioSiInactivo();

        // Ticket
        const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);
        const socioNombre = this.nombreCompleto();

        // "Efectivo: $X · Tarjeta: $Y · Transferencia: $Z"
        const pagoLabel = (pagos ?? [])
          .filter((p) => (p?.monto ?? 0) > 0)
          .map((p) => {
            const label =
              p.tipoPago === 'EFECTIVO'
                ? 'Efectivo'
                : p.tipoPago === 'TARJETA'
                ? 'Tarjeta'
                : 'Transferencia';
            const m = Number(p.monto) || 0;
            return `${label}: ${new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(m)}`;
          })
          .join(' · ');
        const folioTicket = resp?.folio 
        this.ticket.imprimirMembresiaDesdeContexto({
          ctx,
          folio: folioTicket,
          fecha: new Date(), // o resp?.fechaInicio
          socioNombre,
          paqueteNombre: paquete?.nombre ?? null,
          precioPaquete: Number(paquete?.precio ?? 0),
          descuento: Number(this.descuentoSelSig() ?? 0),
          costoInscripcion: 0,
          tipoPago: pagoLabel || '—',
        });

        this.store.dispatch(ReinscripcionActions.reset());
        this.router.navigate(['/pages/socio', this.idSocio, 'historial']);
      },
      error: () => {
        this.guardando = false;
        this.notify.error('No se pudo completar la reinscripción.');
      },
    });
  }

  /** Si el socio está inactivo, lo marca activo=true y sincroniza el signal local. */
  private activarSocioSiInactivo(): void {
    const s = this.socio();
    if (!s?.idSocio) return;
    if (s.activo === false) {
      // Si tu backend acepta PATCH, con {activo:true} basta.
      // Si requiere el objeto completo, usa {...s, activo:true}.
      const dto: SocioData = { ...s, activo: true } as SocioData;


      this.socioSrv.actualizar(s.idSocio, dto as SocioData).subscribe({
        next: (resp) => {
          // Refleja en UI; usa lo devuelto o el merge local
          this.socio.set({ ...(s as SocioData), ...(resp ?? {}), activo: true });
          // (opcional) this.notify.exito('Socio activado automáticamente por reinscripción.');
        },
        error: () => {
          // No detenemos el flujo por esto; solo informativo si quieres:
          // this.notify.aviso('La reinscripción se completó, pero no se pudo reactivar al socio.');
        }
      });
    }
  }

  nombreCompleto(): string {
    const s = this.socio();
    return s ? `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() : '';
  }

  // Contexto ticket
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
          next: (g) => {
            this.gym = g;
          },
          error: () => {
            this.gym = null;
          },
        });
      }
    } catch {
      /* noop */
    }
  }
}
