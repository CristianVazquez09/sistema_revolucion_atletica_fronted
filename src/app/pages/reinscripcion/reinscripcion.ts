import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SocioService } from '../../services/socio-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';

import { SocioData } from '../../model/socio-data';
import { MembresiaData } from '../../model/membresia-data';
import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { TipoPago } from '../../util/enums/tipo-pago';
import { ResumenCompra } from '../resumen-compra/resumen-compra';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { hoyISO, calcularFechaFin } from '../../util/fechas-precios';

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
  selectListaPaquetes, selectPaqueteActual, selectPrecioPaquete,
  selectTotalVista, selectTotalSinDescuento, selectFechaPagoVista,
  selectDescuento, selectFechaInicio, selectPaqueteId
} from './state/reinscripcion-selectors';
import { PaqueteService } from '../../services/paquete-service';

@Component({
  selector: 'app-reinscripcion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ResumenCompra, TiempoPlanLabelPipe],
  templateUrl: './reinscripcion.html',
  styleUrl: './reinscripcion.css'
})
export class Reinscripcion implements OnInit {
  // Inyección
  private fb         = inject(FormBuilder);
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);

  private socioSrv     = inject(SocioService);
  private membresiaSrv = inject(MembresiaService);
  private notify       = inject(NotificacionService);
  private paqueteSrv = inject(PaqueteService)

  // Ticket
  private gymSrv = inject(GimnasioService);
  private ticket = inject(TicketService);
  private jwt    = inject(JwtHelperService);

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
    paqueteId:   this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento:   this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>(hoyISO()),
    movimiento:  this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION'),
  });

  // Signals del store
  listaPaquetesSig   = this.store.selectSignal(selectListaPaquetes);
  paqueteActualSig   = this.store.selectSignal(selectPaqueteActual);
  precioPaqueteSig   = this.store.selectSignal(selectPrecioPaquete);
  totalVistaSig      = this.store.selectSignal(selectTotalVista);
  totalSinDescSig    = this.store.selectSignal(selectTotalSinDescuento);
  fechaPagoVistaSig  = this.store.selectSignal(selectFechaPagoVista);
  descuentoSelSig    = this.store.selectSignal(selectDescuento);
  fechaInicioSelSig  = this.store.selectSignal(selectFechaInicio);
  paqueteIdSelSig    = this.store.selectSignal(selectPaqueteId);

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
      next: s => this.socio.set(s ?? null),
      error: () => this.notify.error('No se pudo cargar el socio.')
    });

    // cargar paquetes (SIN effects): HTTP aquí y al terminar despachamos al store
    this.cargandoPaquetes = true;
    this.errorPaquetes = null;
    // Usa tu PaqueteService existente
    
  }

  // ⚠️ Si ya tienes PaqueteService inyectado, QUITA el import dinámico de arriba y usa esto:
  // private paqueteSrv = inject(PaqueteService);
  // y en ngOnInit:
  // this.paqueteSrv.buscarTodos().subscribe({
  //   next: (lista) => { this.store.dispatch(ReinscripcionActions.setListaPaquetes({ paquetes: lista ?? [] })); this.cargandoPaquetes = false; },
  //   error: () => { this.errorPaquetes = 'No se pudieron cargar los paquetes.'; this.cargandoPaquetes = false; }
  // });

  // form -> store
  constructor() {
    this.form.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(id => this.store.dispatch(ReinscripcionActions.setPaqueteId({ paqueteId: Number(id ?? 0) })));

    this.form.controls.descuento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(d => this.store.dispatch(ReinscripcionActions.setDescuento({ descuento: Number(d ?? 0) })));

    this.form.controls.fechaInicio.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(f => this.store.dispatch(ReinscripcionActions.setFechaInicio({ fechaInicio: String(f ?? hoyISO()) })));
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
  cerrarResumen(): void { this.mostrarResumen.set(false); }

  confirmar(tipoPago: TipoPago): void {
    const paquete = this.paqueteActualSig();
    if (!paquete) { this.notify.aviso('Selecciona un paquete.'); return; }

    const fechaInicio = this.fechaInicioSelSig() ?? hoyISO();
    const fechaFin    = calcularFechaFin(fechaInicio, paquete.tiempo);

    const payload = {
      socio:      { idSocio: this.idSocio },
      paquete:    { idPaquete: paquete.idPaquete },
      movimiento: this.form.controls.movimiento.value!, // 'REINSCRIPCION'
      tipoPago,
      descuento:  this.descuentoSelSig()
    };

    this.guardando = true;
    this.membresiaSrv.guardar(payload as any).subscribe({
      next: (resp: any) => {
        this.guardando = false;
        this.mostrarResumen.set(false);
        this.notify.exito('Reinscripción realizada correctamente.');

        // Ticket
        const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);
        const socioNombre = this.nombreCompleto();

        this.ticket.verMembresiaDesdeContexto({
          ctx,
          folio: resp?.idMembresia ?? resp?.id ?? '',
          fecha: new Date(),
          socioNombre,
          paqueteNombre: paquete?.nombre ?? null,
          precioPaquete: Number(paquete?.precio ?? 0),
          descuento: Number(this.descuentoSelSig() ?? 0),
          costoInscripcion: 0,
          tipoPago
        });

        this.store.dispatch(ReinscripcionActions.reset());
        this.router.navigate(['/pages/socio', this.idSocio, 'historial']);
      },
      error: () => {
        this.guardando = false;
        this.notify.error('No se pudo completar la reinscripción.');
      }
    });
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

      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gymSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => { this.gym = g; },
          error: () => { this.gym = null; }
        });
      }
    } catch { /* token inválido */ }
  }
}
