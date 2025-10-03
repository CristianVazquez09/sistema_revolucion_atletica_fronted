import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';

import { SocioService } from '../../services/socio-service';
import { PaqueteService } from '../../services/paquete-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';
import { GimnasioService } from '../../services/gimnasio-service';
import { TicketService } from '../../services/ticket-service';
import { JwtHelperService } from '@auth0/angular-jwt';

import { SocioData } from '../../model/socio-data';
import { PaqueteData } from '../../model/paquete-data';
import { GimnasioData } from '../../model/gimnasio-data';

import { ResumenCompra } from '../resumen-compra/resumen-compra';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { calcularFechaFin, calcularTotal, hoyISO } from '../../util/fechas-precios';
import { TiempoPlan } from '../../util/enums/tiempo-plan';
import { environment } from '../../../environments/environment';

// 👇 Importa pagos[]
import { MembresiaData, PagoData } from '../../model/membresia-data';

@Component({
  selector: 'app-agregar-membresia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ResumenCompra, TiempoPlanLabelPipe],
  templateUrl: './agregar-membresia.html',
  styleUrl: './agregar-membresia.css'
})
export class AgregarMembresia implements OnInit {

  // ── Inyección
  private fb           = inject(FormBuilder);
  private socioSrv     = inject(SocioService);
  private paqueteSrv   = inject(PaqueteService);
  private membresiaSrv = inject(MembresiaService);
  private noti         = inject(NotificacionService);
  private router       = inject(Router);
  private destroyRef   = inject(DestroyRef);

  // para ticket
  private gymSrv       = inject(GimnasioService);
  private ticket       = inject(TicketService);
  private jwt          = inject(JwtHelperService);

  // ── Contexto (ticket)
  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // ── Form búsqueda
  formBusqueda = this.fb.nonNullable.group({
    idSocio: this.fb.nonNullable.control<string>('', [
      Validators.required,
      Validators.pattern(/^\d+$/)
    ])
  });

  // ── Form membresía extra
  formMembresia = this.fb.nonNullable.group({
    paqueteId:   this.fb.nonNullable.control<number>(0, [Validators.min(1)]),
    descuento:   this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    fechaInicio: this.fb.nonNullable.control<string>(hoyISO()),
    movimiento:  this.fb.nonNullable.control<TipoMovimiento>('REINSCRIPCION')
  });

  // ── Estado
  socio    = signal<SocioData | null>(null);
  paquetes: PaqueteData[] = [];

  cargandoSocio = false;
  cargandoPaquetes = true;
  guardando = false;
  error: string | null = null;

  mostrarResumen = signal(false);

  // ── Signals derivados
  private paqueteIdSig   = toSignal(this.formMembresia.controls.paqueteId.valueChanges,   { initialValue: this.formMembresia.controls.paqueteId.value });
  private descuentoSig   = toSignal(this.formMembresia.controls.descuento.valueChanges,  { initialValue: this.formMembresia.controls.descuento.value });
  private fechaInicioSig = toSignal(this.formMembresia.controls.fechaInicio.valueChanges,{ initialValue: this.formMembresia.controls.fechaInicio.value });

  paqueteSeleccionado = computed(() => {
    const id = this.paqueteIdSig();
    return this.paquetes.find(p => p.idPaquete === id) ?? null;
  });

  precioPaquete = computed(() => this.paqueteSeleccionado()?.precio ?? 0);
  descuento     = computed(() => this.descuentoSig());
  total         = computed(() => calcularTotal(this.precioPaquete(), this.descuento()));

  fechaInicio   = computed(() => this.fechaInicioSig());
  fechaFin      = computed(() => {
    const t = this.paqueteSeleccionado()?.tiempo ?? null;
    return calcularFechaFin(this.fechaInicio(), t as TiempoPlan | null);
  });

  // ── Helpers
  get fechaHoyTexto(): string {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    const s = new Date().toLocaleDateString('es-MX', opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  idBonito(id?: number | null): string {
    const n = Number(id ?? 0);
    return n.toString().padStart(3, '0');
  }

  ngOnInit(): void {
    this.cargarContextoDesdeToken(); // 👈 carga gym + cajero para el ticket

    // Cargar paquetes
    this.paqueteSrv.buscarTodos().subscribe({
      next: lista => { this.paquetes = lista ?? []; this.cargandoPaquetes = false; },
      error: () => { this.cargandoPaquetes = false; this.error = 'No se pudieron cargar los paquetes.'; }
    });

    // Asegura fechaInicio
    this.formMembresia.controls.paqueteId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.formMembresia.controls.fechaInicio.value) {
          this.formMembresia.controls.fechaInicio.setValue(hoyISO(), { emitEvent: false });
        }
      });
  }

  // ===== ticket: contexto (gimnasio + cajero) =====
  private cargarContextoDesdeToken(): void {
    const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!token) return;

    try {
      const decoded: any = this.jwt.decodeToken(token);
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;

      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gymSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => this.gym = g,
          error: () => this.gym = null
        });
      }
    } catch { /* noop */ }
  }

  // ── Acciones
  buscarSocio(): void {
    if (this.formBusqueda.invalid) {
      this.noti.aviso('Ingresa un ID numérico de socio (solo dígitos).');
      this.formBusqueda.markAllAsTouched();
      return;
    }
    const id = Number(this.formBusqueda.controls.idSocio.value);
    this.cargarSocio(id);
  }

  limpiarBusqueda(): void {
    this.formBusqueda.reset({ idSocio: '' });
    this.socio.set(null);
    this.error = null;
  }

  abrirResumen(): void {
    if (!this.socio()) { this.noti.aviso('Primero busca un socio.'); return; }
    if ((this.paqueteIdSig() ?? 0) <= 0) {
      this.noti.aviso('Selecciona un paquete para continuar.');
      this.formMembresia.markAllAsTouched();
      return;
    }
    this.mostrarResumen.set(true);
  }
  cerrarResumen(): void { this.mostrarResumen.set(false); }

  // 👇 AHORA recibe pagos[] del modal
  confirmar(pagos: PagoData[]): void {
    const s = this.socio(); if (!s?.idSocio) { this.noti.aviso('Primero busca un socio.'); return; }
    const idPaquete = this.paqueteIdSig(); if ((idPaquete ?? 0) <= 0) { this.noti.aviso('Selecciona un paquete.'); return; }

    // Validación suma de pagos
    const totalUI = this.total() ?? 0;
    const sumaPagos = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(totalUI - sumaPagos) > 0.01) {
      this.noti.aviso('La suma de pagos no coincide con el total.');
      return;
    }

    const fechaInicio = this.fechaInicio();
    const fechaFin    = this.fechaFin(); // lo calculamos para cumplir tu interfaz

    // Payload cumpliendo tu interfaz (paquete con solo id -> cast)
    const payload: MembresiaData = {
      socio:   { idSocio: s.idSocio } as SocioData,
      paquete: { idPaquete: idPaquete! } as unknown as PaqueteData,
      fechaInicio,
      fechaFin,
      movimiento: this.formMembresia.controls.movimiento.value!, // 'REINSCRIPCION'
      pagos,
      descuento: this.descuento() ?? 0,
      total: totalUI
    };

    this.guardando = true;
    this.membresiaSrv.guardar(payload as any)
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (resp: any) => {
          this.mostrarResumen.set(false);
          this.noti.exito('Paquete extra agregado correctamente.');

          // ====== TICKET ======
          const negocio = {
            nombre:    this.gym?.nombre ?? 'Tu gimnasio',
            direccion: this.gym?.direccion ?? '',
            telefono:  this.gym?.telefono ?? ''
          };

          // Texto de pagos para el ticket
          const pagoLabel = (pagos ?? [])
            .filter(p => (p?.monto ?? 0) > 0)
            .map(p => {
              const lbl = p.tipoPago === 'EFECTIVO' ? 'Efectivo' : p.tipoPago === 'TARJETA' ? 'Tarjeta' : 'Transferencia';
              return `${lbl}: ${new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(Number(p.monto)||0)}`;
            })
            .join(' · ');

          const folio        = resp?.idMembresia ?? resp?.id ?? '';
          const socioNombre  = `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim();
          const pSel         = this.paqueteSeleccionado();
          const concepto     = resp?.paquete?.nombre
            ? `Membresía ${resp.paquete.nombre}`
            : (pSel?.nombre ? `Membresía ${pSel.nombre}` : 'Membresía');
          const importe      = Number(resp?.total ?? totalUI);
          const fechaTicket  = resp?.fechaInicio ?? new Date();

          this.ticket.verMembresiaComoHtml({
            negocio,
            folio,
            fecha: fechaTicket,
            cajero: this.cajero,
            socio: socioNombre,
            concepto,
            importe,
            tipoPago: pagoLabel || '—'
          });

          this.router.navigate(['/pages/socio', s.idSocio, 'historial']);
        },
        error: () => this.noti.error('No se pudo agregar el paquete.')
      });
  }

  // ── Privados
  private cargarSocio(id: number): void {
    this.cargandoSocio = true;
    this.error = null;

    this.socioSrv.buscarPorId(id).pipe(
      catchError(err => {
        if (err?.status === 403 || err?.status === 404) return of(null);
        throw err;
      }),
      finalize(() => (this.cargandoSocio = false))
    ).subscribe({
      next: (s) => {
        if (!s) {
          this.socio.set(null);
          this.error = 'Socio no encontrado o no pertenece a tu gimnasio.';
          this.noti.error(this.error);
          return;
        }
        this.socio.set(s);
      },
      error: () => {
        this.error = 'No se pudo cargar el socio.';
        this.noti.error(this.error);
      }
    });
  }
}
