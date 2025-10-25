// src/app/pages/asistencia/asistencia.ts
import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';

import { SocioService } from '../../services/socio-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';
import { AsistenciaStore } from './asistencia-store';

import { MembresiaData } from '../../model/membresia-data';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { hoyISO } from '../../util/fechas-precios';
import { environment } from '../../../environments/environment';

type EstadoSemaforo = 'verde' | 'amarillo' | 'rojo';

@Component({
  selector: 'app-asistencia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TiempoPlanLabelPipe],
  templateUrl: './asistencia.html',
  styleUrl: './asistencia.css',
})
export class Asistencia implements OnInit {
  // ───────────────────── Inyección de dependencias ─────────────────────
  private readonly formBuilder = inject(FormBuilder);
  private readonly socioService = inject(SocioService);
  private readonly membresiaService = inject(MembresiaService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly asistenciaStore = inject(AsistenciaStore);
  private readonly jwtHelper = inject(JwtHelperService);

  // ───────────────────── Formulario ─────────────────────
  formulario = this.formBuilder.nonNullable.group({
    idSocio: this.formBuilder.nonNullable.control<string>('', [
      Validators.required,
      Validators.pattern(/^\d+$/),
    ]),
  });

  // ───────────────────── Estado de vista ─────────────────────
  cargando = false;
  error: string | null = null;

  // Signals expuestos por el store (no tocar el HTML)
  socio = this.asistenciaStore.socio;
  membresias = this.asistenciaStore.membresias;

  // Fecha actual
  hoy = hoyISO();
  get fechaHoyTexto(): string {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    };
    const s = new Date().toLocaleDateString('es-MX', opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ───────────────────── Derivados de UI ─────────────────────
  // ───────────── NUEVO: respeta socio inactivo ─────────────
  private socioInactivo = computed(() => {
    const s = this.socio();
    return !!s && (s as any)?.activo === false;
  });

  // Si el socio está inactivo, TODAS las tarjetas se pintan en rojo
  tarjetas = computed(() =>
    (this.membresias() ?? []).map((m) => ({
      ...m,
      estado: this.socioInactivo()
        ? ('rojo' as EstadoSemaforo)
        : (this.calcularSemaforo(m.fechaFin) as EstadoSemaforo),
    }))
  );

  // Si está inactivo, no está autorizado aunque tenga membresía vigente
  autorizado = computed(
    () =>
      !this.socioInactivo() && this.tarjetas().some((t) => t.estado !== 'rojo')
  );

  // Si está inactivo, no mostramos próxima fecha de pago
  proximaFechaPago = computed(() => {
    if (this.socioInactivo()) return null;
    const fechas = this.tarjetas()
      .filter((t) => t.estado !== 'rojo')
      .map((t) => t.fechaFin!)
      .filter(Boolean)
      .sort();
    return fechas[0] ?? null;
  });

  // ───────────────────── Ciclo de vida ─────────────────────
  ngOnInit(): void {
    this.inicializarDesdePersistencia();
  }

  // ───────────────────── Acciones públicas (compatibles con el HTML) ─────────────────────
  buscar(): void {
    if (this.formulario.invalid) {
      this.notificaciones.aviso(
        'Ingresa un ID numérico de socio (solo dígitos).'
      );
      this.formulario.markAllAsTouched();
      return;
    }
    const id = Number(this.formulario.controls.idSocio.value);
    this.cargarDatosDeSocioPorId(id);
  }

  limpiar(): void {
    this.formulario.reset({ idSocio: '' });
    this.asistenciaStore.limpiar();
    this.limpiarIdSocioPersistidoDeTenant();
    this.error = null;
  }

  // Mantener compatibilidad con el HTML
  idBonito(id?: number | null): string {
    return this.formatearId(id);
  }

  // ───────────────────── Lógica principal ─────────────────────
  /** Carga inicial: rehidrata último socio del tenant/usuario, o limpia si no hay nada. */
  private inicializarDesdePersistencia(): void {
    const ultimoId = this.leerIdSocioPersistidoDeTenant();
    if (ultimoId != null) {
      this.formulario.controls.idSocio.setValue(String(ultimoId));
      this.cargarDatosDeSocioPorId(ultimoId);
    } else {
      this.asistenciaStore.limpiar(); // evita residuos de sesiones previas
    }
  }

  /** Carga socio + membresías en paralelo, con manejo de errores y persistencia. */
  private cargarDatosDeSocioPorId(id: number): void {
    this.cargando = true;
    this.error = null;

    const socio$ = this.socioService.buscarPorId(id).pipe(
      catchError((err) => {
        // No pertenece al gimnasio o no existe
        if (err?.status === 403 || err?.status === 404) return of(null);
        // Otros errores suben al bloque error del subscribe
        throw err;
      })
    );

    const membresias$ = this.membresiaService
      .buscarMembresiasVigentesPorSocio(id)
      .pipe(
        // Si fallan, no tumbamos todo; mostramos aviso y seguimos con socio si existe
        catchError(() => of([] as MembresiaData[]))
      );

    forkJoin({ socio: socio$, membresias: membresias$ })
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: ({ socio, membresias }) => {
          if (!socio) {
            this.asistenciaStore.limpiar();
            this.limpiarIdSocioPersistidoDeTenant();
            const msg = 'Socio no encontrado o no pertenece a tu gimnasio.';
            this.error = msg;
            this.notificaciones.error(msg);
            return;
          }
          this.asistenciaStore.guardarEstado(id, socio, membresias ?? []);
          this.persistirIdSocioDeTenant(id);
        },
        error: (e) =>
          this.notificarError(e, 'No se pudo realizar la consulta.'),
      });
  }

  // ───────────────────── Helpers de UI ─────────────────────
  private calcularSemaforo(fechaFinISO?: string | null): EstadoSemaforo {
    if (!fechaFinISO) return 'rojo';
    const hoy = new Date(this.hoy + 'T00:00:00');
    const fin = new Date(fechaFinISO + 'T00:00:00');
    const dias = Math.floor(
      (fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dias > 3) return 'verde';
    if (dias > 0) return 'amarillo'; // 1–3 días
    return 'rojo'; // hoy o vencido
  }

  private formatearId(id?: number | null): string {
    const n = Number(id ?? 0);
    return n.toString().padStart(3, '0');
  }

  // ───────────────────── Errores / mensajes ─────────────────────
  private notificarError(e: any, reserva: string): void {
    const msg = this.mensajeLegible(e, 'GEN', reserva);
    this.error = msg;
    this.notificaciones.error(msg);
  }

  /** Mensaje claro según contexto y status. */
  private mensajeLegible(
    err: any,
    ctx: 'SOCIO' | 'MEMBRESIAS' | 'GEN',
    fallback: string
  ): string {
    const body = err?.error ?? {};
    const fromBody = body.message ?? body.error ?? body.title ?? null;

    // Validación 422 con detalles
    if (Array.isArray(body.errors) && body.errors.length) {
      const first = body.errors[0];
      const detail =
        first?.defaultMessage || first?.message || JSON.stringify(first);
      return fromBody ? `${fromBody}: ${detail}` : detail;
    }

    switch (err?.status) {
      case 0:
        return 'Sin conexión con el servidor.';
      case 400:
        return ctx === 'SOCIO'
          ? fromBody ?? 'El ID de socio no es válido.'
          : fromBody ?? 'Solicitud inválida.';
      case 401:
        return fromBody ?? 'Tu sesión expiró o no estás autenticado (401).';
      case 403:
      case 404:
        if (ctx === 'SOCIO')
          return 'Socio no encontrado o no pertenece a tu gimnasio.';
        return fromBody ?? 'No se encontraron datos.';
      case 409:
        return fromBody ?? 'Conflicto de datos (409).';
      case 422:
        return fromBody ?? 'Datos inválidos (422).';
      case 500:
        return fromBody ?? 'Error interno del servidor (500).';
      default:
        return fromBody ?? err?.message ?? fallback;
    }
  }

  // ───────────────────── Persistencia por tenant/usuario ─────────────────────
  /** Clave única por tenant (+usuario si existe en el token). */
  private clavePersistencia(): string | null {
    const t = sessionStorage.getItem('tenantId');
    if (t != null) return `asistenciaSocioId@tenant:${t}`;

    const token = sessionStorage.getItem(environment.TOKEN_NAME);
    if (!token) return null;
    try {
      const decoded: any = this.jwtHelper.decodeToken(token);
      const tenantId = decoded?.tenantId ?? decoded?.gimnasioId ?? null;
      const user = decoded?.preferred_username ?? decoded?.sub ?? 'user';
      return tenantId != null
        ? `asistenciaSocioId@tenant:${tenantId}|user:${user}`
        : null;
    } catch {
      return null;
    }
  }

  private persistirIdSocioDeTenant(id: number): void {
    const key = this.clavePersistencia();
    if (key) sessionStorage.setItem(key, String(id));
  }

  private leerIdSocioPersistidoDeTenant(): number | null {
    const key = this.clavePersistencia();
    if (!key) return null;
    const raw = sessionStorage.getItem(key);
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) ? id : null;
  }

  private limpiarIdSocioPersistidoDeTenant(): void {
    const key = this.clavePersistencia();
    if (key) sessionStorage.removeItem(key);
  }
}
