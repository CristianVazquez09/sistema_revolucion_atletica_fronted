// src/app/pages/agregar-membresia/agregar-membresia.ts
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
import { TipoPago } from '../../util/enums/tipo-pago';
import { TipoMovimiento } from '../../util/enums/tipo-movimiento';
import { calcularFechaFin, calcularTotal, hoyISO } from '../../util/fechas-precios';
import { TiempoPlan } from '../../util/enums/tiempo-plan';
import { environment } from '../../../environments/environment';

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
  fechaPago     = computed(() => {
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

    // Cargar cat. paquetes para el selector
    this.paqueteSrv.buscarTodos().subscribe({
      next: lista => { this.paquetes = lista ?? []; this.cargandoPaquetes = false; },
      error: () => { this.cargandoPaquetes = false; this.error = 'No se pudieron cargar los paquetes.'; }
    });

    // Si cambian paquete, asegura fecha inicio
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

      // Cajero (username del token)
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;

      // id_gimnasio en el token (o tenantId / gimnasioId)
      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gymSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => this.gym = g,
          error: () => this.gym = null // no romper flujo
        });
      }
    } catch {
      // token inválido → usar fallbacks
    }
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

  confirmar(tipoPago: TipoPago): void {
    const s = this.socio(); if (!s?.idSocio) { this.noti.aviso('Primero busca un socio.'); return; }
    const idPaquete = this.paqueteIdSig(); if ((idPaquete ?? 0) <= 0) { this.noti.aviso('Selecciona un paquete.'); return; }

    const payload = {
      socio:      { idSocio: s.idSocio },
      paquete:    { idPaquete },
      movimiento: this.formMembresia.controls.movimiento.value!, // 'REINSCRIPCION'
      tipoPago,
      descuento:  this.descuento()
      // total/fechaInicio: UI
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

          const folio = resp?.idMembresia ?? resp?.id ?? ''; // usa el id que devuelva tu backend
          const socioNombre = `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim();
          const p = this.paqueteSeleccionado();
          const concepto = resp?.paquete?.nombre
            ? `Membresía ${resp.paquete.nombre}`
            : (p?.nombre ? `Membresía ${p.nombre}` : 'Membresía');

          const importe = Number(resp?.total ?? this.total());
          const fecha   = resp?.fechaInicio ?? new Date();
          const pago    = resp?.tipoPago ?? tipoPago;

          // Para pruebas en pantalla:
          this.ticket.verMembresiaComoHtml({
            negocio,
            folio,                 // aparecerá grande/centrado si ya actualizaste el TicketService
            fecha,
            cajero: this.cajero,
            socio: socioNombre,
            concepto,
            importe,
            tipoPago: pago
          });

          // Para impresión real:
          // this.ticket.imprimirMembresia({ negocio, folio, fecha, cajero: this.cajero, socio: socioNombre, concepto, importe, tipoPago: pago });
          // ======================

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
