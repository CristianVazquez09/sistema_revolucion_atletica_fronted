import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';

import { SocioService } from '../../services/socio-service';
import { MembresiaService } from '../../services/membresia-service';
import { NotificacionService } from '../../services/notificacion-service';
import { AsistenciaStore } from './asistencia-store';

import { MembresiaData } from '../../model/membresia-data';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { dateLocalFromISO, hoyISO } from '../../util/fechas-precios';
import { HuellaModal, HuellaResultado } from '../huella-modal/huella-modal';

import { PaqueteData } from '../../model/paquete-data';
import { TiempoPlan } from '../../util/enums/tiempo-plan';
import { CheckInService } from 'src/app/services/check-in-service';

type EstadoSemaforo = 'verde' | 'amarillo' | 'rojo';

@Component({
  selector: 'app-asistencia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TiempoPlanLabelPipe, HuellaModal],
  templateUrl: './asistencia.html',
  styleUrl: './asistencia.css',
})
export class Asistencia implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly socioService = inject(SocioService);
  private readonly membresiaService = inject(MembresiaService);
  private readonly notificaciones = inject(NotificacionService);
  private readonly asistenciaStore = inject(AsistenciaStore);
  private readonly jwtHelper = inject(JwtHelperService);
  private readonly checkInService = inject(CheckInService);

  formulario = this.formBuilder.nonNullable.group({
    idSocio: this.formBuilder.nonNullable.control<string>('', [
      Validators.required,
      Validators.pattern(/^\d+$/),
    ]),
  });

  cargando = false;
  /** Error de “pantalla” (búsqueda / carga de socio+membresías) */
  error: string | null = null;
  /** Error puntual de operación (p.ej. check-in 409) para mostrar banner */
  errorOperacion: string | null = null;

  // modal de huella
  mostrarHuellaModal = false;

  socio = this.asistenciaStore.socio;
  membresias = this.asistenciaStore.membresias;

  hoy = hoyISO();
  get fechaHoyTexto(): string {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    };
    const s = new Date().toLocaleDateString('es-MX', opts);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private socioInactivo = computed(() => {
    const s = this.socio();
    return !!s && (s as any)?.activo === false;
  });

  tarjetas = computed(() =>
    (this.membresias() ?? []).map((m) => ({
      ...m,
      estado: this.socioInactivo()
        ? ('rojo' as EstadoSemaforo)
        : (this.calcularSemaforo(m.fechaFin) as EstadoSemaforo),
        
        
    }))
    
  );

  
  autorizado = computed(
    () => !this.socioInactivo() && this.tarjetas().some((t) => t.estado !== 'rojo')
  );

  proximaFechaPago = computed(() => {
    if (this.socioInactivo()) return null;
    const fechas = this.tarjetas()
      .filter((t) => t.estado !== 'rojo')
      .map((t) => t.fechaFin!)
      .filter(Boolean)
      .sort();
    return fechas[0] ?? null;
  });

  ngOnInit(): void {
    console.log('[FECHAS] nowLocal:', new Date().toString());
  console.log('[FECHAS] nowISO  :', new Date().toISOString());
  console.log('[FECHAS] tzOffsetMin:', new Date().getTimezoneOffset());
  console.log('[FECHAS] hoyISO():', hoyISO());
    this.inicializarDesdePersistencia();
  }

  // ─── Botones UI ─────────────────────────────────────────────
  buscar(): void {
    if (this.formulario.invalid) {
      this.notificaciones.aviso('Ingresa un ID numérico de socio (solo dígitos).');
      this.formulario.markAllAsTouched();
      return;
    }
    const id = Number(this.formulario.controls.idSocio.value);
    this.cargarDatosDeSocioPorId(id);
  }

  abrirHuellaModal(): void {
    this.error = null;
    this.errorOperacion = null;
    this.mostrarHuellaModal = true;
  }

  onHuellaCancel(): void {
    this.mostrarHuellaModal = false;
  }

  onHuellaConfirmar(res: HuellaResultado): void {
    this.mostrarHuellaModal = false;
    const base64 = res?.muestras?.[0] ?? '';
    if (!base64) {
      this.notificaciones.aviso('No se recibió una muestra válida.');
      return;
    }
    this.cargarDatosDeSocioPorHuella(base64);
  }

  limpiar(): void {
    this.formulario.reset({ idSocio: '' });
    this.asistenciaStore.limpiar();
    this.limpiarIdSocioPersistidoDeTenant();
    this.error = null;
    this.errorOperacion = null;
  }

  idBonito(id?: number | null): string {
    return this.formatearId(id);
  }

  // ─── Check-in ───────────────────────────────────────────────
  private esPlanPorVisitas(p?: PaqueteData | null): boolean {
    const t = p?.tiempo;
    return t === TiempoPlan.VISITA_10 || t === TiempoPlan.VISITA_15 || p?.visitasMaximas != null;
  }

  protected hoyEsFinde(): boolean {
    const d = new Date();
    const day = d.getDay(); // 0=Dom, 1=Lun, ... 6=Sáb
    return day === 0 || day === 5 || day === 6; // Vie(5) Sáb(6) Dom(0)
  }

  private membresiaVencida(fechaFinISO?: string | null): boolean {
  if (!fechaFinISO) return true;

  const hoy = dateLocalFromISO(hoyISO());
  const fin = dateLocalFromISO(fechaFinISO);

  return fin.getTime() < hoy.getTime(); // ✅ mismo día NO es vencida
}


  /** Null si se permite check-in; string con motivo si se bloquea. */
  motivoBloqueoCheckIn(m: MembresiaData): string | null {
    if (this.socioInactivo()) return 'Socio inactivo';
    if (this.membresiaVencida(m.fechaFin)) return 'Membresía vencida';

    const p = m.paquete;
    if (p?.soloFinesDeSemana && !this.hoyEsFinde()) return 'Acceso solo Vie/Sáb/Dom';

    if (this.esPlanPorVisitas(p)) {
      const rest = Number(m.visitasRestantes ?? 0);
      if (!Number.isFinite(rest) || rest <= 0) return 'Sin visitas disponibles';
    }
    return null;
  }

  registrarCheckIn(m: MembresiaData): void {
    const bloqueo = this.motivoBloqueoCheckIn(m);
    if (bloqueo) {
      this.errorOperacion = bloqueo;
      this.notificaciones.aviso(bloqueo);
      return;
    }

    this.errorOperacion = null;
    this.cargando = true;

    this.checkInService
      .registrarEntradaPorMembresia(m.idMembresia!)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          if (!resp?.autorizado) {
            const msg = resp?.motivo || 'No autorizado';
            this.errorOperacion = msg;
            this.notificaciones.aviso(msg);
            return;
          }

          // Actualizar membresía retornada por backend (incl. visitasRestantes)
          const lista = [...(this.membresias() ?? [])];
          const idx = lista.findIndex((x) => x.idMembresia === m.idMembresia);
          if (idx >= 0 && resp.membresia) {
            lista[idx] = resp.membresia;
            this.asistenciaStore.guardarEstado(this.socio()!.idSocio, this.socio(), lista);
          } else {
            const id = this.socio()?.idSocio;
            if (id) this.cargarDatosDeSocioPorId(id);
          }

          const visitasTxt = this.esPlanPorVisitas(resp.membresia?.paquete)
            ? ` | Visitas restantes: ${resp.membresia.visitasRestantes}/${resp.membresia.paquete.visitasMaximas ?? '—'}`
            : '';
          this.notificaciones.exito(`Check-in registrado${visitasTxt}`);
          this.errorOperacion = null;
        },
        error: (e) => {
          const msg = this.mensajeLegibleRFC7807(e, 'No se pudo registrar el check-in.');
          this.errorOperacion = msg;
          this.notificaciones.error(msg);
        },
      });
  }

  // ─── Lógica de carga ────────────────────────────────────────
  private inicializarDesdePersistencia(): void {
    const ultimoId = this.leerIdSocioPersistidoDeTenant();
    if (ultimoId != null) {
      this.formulario.controls.idSocio.setValue(String(ultimoId));
      this.cargarDatosDeSocioPorId(ultimoId);
    } else {
      this.asistenciaStore.limpiar();
    }
    
  }

  private cargarDatosDeSocioPorId(id: number): void {
    this.cargando = true;
    this.error = null;
    this.errorOperacion = null;

    const socio$ = this.socioService.buscarPorId(id).pipe(
      catchError((err) => {
        if (err?.status === 403 || err?.status === 404) return of(null);
        throw err;
      })
    );

    const membresias$ = this.membresiaService
      .buscarMembresiasVigentesPorSocio(id)
      .pipe(catchError(() => of([] as MembresiaData[])));

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
        error: (e) => this.notificarErrorPantalla(e, 'No se pudo realizar la consulta.'),
      });
  }

  private cargarDatosDeSocioPorHuella(huellaBase64: string): void {
    this.cargando = true;
    this.error = null;
    this.errorOperacion = null;

    this.checkInService
      .registrarEntradaPorHuella(huellaBase64)
      .pipe(
        catchError((err) => {
          if (err?.status === 403 || err?.status === 404) return of(null);
          throw err;
        }),
        switchMap((socio) => {
          if (!socio) {
            return of({ socio: null as any, membresias: [] as MembresiaData[] });
          }
          return forkJoin({
            socio: of(socio),
            membresias: this.membresiaService
              .buscarMembresiasVigentesPorSocio(socio.idSocio)
              .pipe(catchError(() => of([] as MembresiaData[]))),
          });
        }),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ socio, membresias }) => {
          if (!socio) {
            this.asistenciaStore.limpiar();
            this.limpiarIdSocioPersistidoDeTenant();
            const msg = 'Huella no encontrada o no pertenece a tu gimnasio.';
            this.error = msg;
            this.notificaciones.error(msg);
            return;
          }
          this.formulario.controls.idSocio.setValue(String(socio.idSocio));
          this.asistenciaStore.guardarEstado(socio.idSocio, socio, membresias ?? []);
          this.persistirIdSocioDeTenant(socio.idSocio);
        },
        error: (e) => this.notificarErrorPantalla(e, 'No se pudo realizar la consulta por huella.'),
      });
  }

  // ─── Helpers de UI ──────────────────────────────────────────
  private calcularSemaforo(fechaFinISO?: string | null): EstadoSemaforo {
  if (!fechaFinISO) return 'rojo';

  const hoy = dateLocalFromISO(hoyISO());
  const fin = dateLocalFromISO(fechaFinISO);

  const dias = Math.floor((fin.getTime() - hoy.getTime()) / 86400000);

  if (dias > 3) return 'verde';
  if (dias >= 0) return 'amarillo'; // ✅ incluye el “último día”
  return 'rojo';
}


  private formatearId(id?: number | null): string {
    const n = Number(id ?? 0);
    return n.toString().padStart(3, '0');
  }

  // ─── Manejo de errores legibles (incluye RFC7807) ───────────
  private mensajeLegibleRFC7807(err: any, fallback: string): string {
    const body = err?.error ?? {};
    // RFC 7807
    const title = body.title ?? null;
    const detail = body.detail ?? null;
    // Validaciones comunes
    const msg = body.message ?? null;
    const errorTxt = body.error ?? null;

    // Bean Validation style
    if (Array.isArray(body.violations) && body.violations.length) {
      const v = body.violations[0];
      const vm = v?.message || JSON.stringify(v);
      return detail ? `${detail}` : vm;
    }
    // Spring errors[]
    if (Array.isArray(body.errors) && body.errors.length) {
      const first = body.errors[0];
      const detailFirst = first?.defaultMessage || first?.message || JSON.stringify(first);
      return detail ? `${detail}` : detailFirst;
    }

    if (detail) return detail;
    if (msg) return msg;
    if (errorTxt) return errorTxt;
    if (title) return title;

    switch (err?.status) {
      case 0:   return 'Sin conexión con el servidor.';
      case 400: return 'Solicitud inválida (400).';
      case 401: return 'No autenticado (401).';
      case 403: return 'Sin autorización para esta operación (403).';
      case 404: return 'Recurso no encontrado (404).';
      case 409: return 'Conflicto de datos (409).';
      case 422: return 'Datos inválidos (422).';
      case 500: return 'Error interno del servidor (500).';
      default:  return fallback;
    }
  }

  private notificarErrorPantalla(e: any, reserva: string): void {
    const msg = this.mensajeLegibleRFC7807(e, reserva);
    this.error = msg;
    this.notificaciones.error(msg);
  }

  // ─── Persistencia ligera de ID socio por tenant ─────────────
  private clavePersistencia(): string | null {
    const t = sessionStorage.getItem('tenantId');
    if (t != null) return `asistenciaSocioId@tenant:${t}`;

    const token = sessionStorage.getItem('ra_token');
    if (!token) return null;
    try {
      const decoded: any = this.jwtHelper.decodeToken(token);
      const tenantId = decoded?.tenantId ?? decoded?.gimnasioId ?? null;
      const user = decoded?.preferred_username ?? decoded?.sub ?? 'user';
      return tenantId != null ? `asistenciaSocioId@tenant:${tenantId}|user:${user}` : null;
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
