import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';
import { distinctUntilChanged, skip } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CorteCajaService } from '../../services/corte-caja-service';
import { NotificacionService } from '../../services/notificacion-service';
import {
  CorteCajaResponseDTO,
  CerrarCorte,
  OrigenCorte,
  CorteCajaPreviewDTO,
  SalidaEfectivo,
  RegistrarSalidaEfectivoRequest,
  CorteDesgloseDTO,
  CorteMovimientoViewDTO,
} from '../../model/corte-caja-data';
import { environment } from '../../../environments/environment';
import { TicketService } from '../../services/ticket-service';

// ✅ Modal
import { CorteCajaModal } from './corte-caja-modal/corte-caja-modal';

// ✅ selector admin
import { TenantContextService } from 'src/app/core/tenant-context.service';
import { RaGimnasioFilterComponent } from 'src/app/shared/ra-app-zoom/ra-gimnasio-filter/ra-gimnasio-filter';

@Component({
  selector: 'app-corte-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, CorteCajaModal, RaGimnasioFilterComponent],
  templateUrl: './corte-caja.html',
  styleUrl: './corte-caja.css',
})
export class CorteCaja implements OnInit, OnDestroy {
  corte: CorteCajaResponseDTO | null = null;
  preview: CorteCajaPreviewDTO | null = null;
  salidas: SalidaEfectivo[] = [];

  // ===== Desglose (encabezado + movimientos + salidas) =====
  desglose: CorteDesgloseDTO | null = null;
  movimientos: CorteMovimientoViewDTO[] = [];
  cargandoDesglose = false;

  // ✅ Modal state
  modalMovimientosAbierto = false;

  cargando = false;
  error: string | null = null;

  // Formularios
  fondoCajaInicial: number = 0;
  efectivoEntregado: number | null = null;
  efectivoEnCajaConteo: number | null = null;

  salidaConcepto = '';
  salidaMonto: number | null = null;

  // cache del usuario logueado
  usuarioLogueado = '';

  // watchers
  private watchOpenId: any = null;

  private srv = inject(CorteCajaService);
  private noti = inject(NotificacionService);
  private jwt = inject(JwtHelperService);
  private ticket = inject(TicketService);

  private tenantCtx = inject(TenantContextService);
  private destroyRef = inject(DestroyRef);

  // UI flags
  esAdmin = false;

  ngOnInit(): void {
  // ✅ Asegura que el TenantContext se inicialice desde token y sessionStorage
  this.tenantCtx.initFromToken();

  // ✅ Admin real (usa el mismo criterio del TenantContextService)
  this.esAdmin = this.tenantCtx.isAdmin;


  // ✅ Si eres admin, escucha cambios del selector para recargar
  if (this.esAdmin) {
    this.tenantCtx.viewTenantChanges$
      .pipe(
        distinctUntilChanged(),
        skip(1),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.onTenantChanged(false));
  }

  this.cargarUsuarioDesdeStorageYToken();

  // ✅ primer load
  this.onTenantChanged(true);
}


  ngOnDestroy(): void {
  this.detenerWatcherCorteAbierto();

  // ✅ IMPORTANTE: si eres admin, al salir de Corte resetea a "Todos"
  // para que otros módulos no queden filtrados.
  if (this.esAdmin) {
    this.tenantCtx.setViewTenant(null);
  }
}


  // ========= TENANT / SELECCIÓN =========

  // ✅ tenant seleccionado para VISTA:
  // - admin: lo que eligió en selector (puede ser null => "Todos")
  // - no admin: tenant del token/storage
  private get tenantSeleccionado(): number | null {
    if (this.esAdmin) return this.tenantCtx.viewTenantId;
    return this.tenantIdDesdeStorageOToken();
  }

  // ✅ Corte de caja exige tenant. Si admin está en "Todos", entonces se requiere seleccionar 1.
  get requiereSeleccionGimnasio(): boolean {
    return this.esAdmin && this.tenantSeleccionado == null;
  }

  private onTenantChanged(isFirstLoad = false): void {
    // ✅ Si admin está en "Todos" => NO pegamos al backend (corte exige tenant)
    if (this.requiereSeleccionGimnasio) {
      this.detenerWatcherCorteAbierto();
      this.resetVistaCompleta();
      if (!isFirstLoad) this.noti.info('Selecciona un gimnasio para ver el corte de caja.');
      return;
    }

    // reset + recargar
    this.detenerWatcherCorteAbierto();
    this.resetVistaCompleta();

    const idPersistido = this.obtenerCortePersistidoPorTenant();

    if (idPersistido != null) {
      this.cargarCortePorId(idPersistido, true);
    } else {
      this.autocargarCorteAbierto();
    }

    // watcher sólo si no hay corte abierto
    this.iniciarWatcherCorteAbierto();
  }

  private resetVistaCompleta(): void {
    this.corte = null;
    this.preview = null;
    this.salidas = [];
    this.desglose = null;
    this.movimientos = [];
    this.modalMovimientosAbierto = false;
    this.error = null;
    this.cargando = false;
    this.cargandoDesglose = false;
    this.fondoCajaInicial = 0;
    this.efectivoEntregado = null;
    this.efectivoEnCajaConteo = null;
    this.salidaConcepto = '';
    this.salidaMonto = null;
  }

  // ===== UI: Modal =====
  abrirModalMovimientos(): void {
    if (this.requiereSeleccionGimnasio) {
      this.noti.aviso('Selecciona un gimnasio.');
      return;
    }
    if (!this.estaAbierto) {
      this.noti.aviso('No hay corte abierto.');
      return;
    }
    this.modalMovimientosAbierto = true;

    if (!this.movimientos?.length) {
      this.refrescarDesgloseActual();
    }
  }

  cerrarModalMovimientos(): void {
    this.modalMovimientosAbierto = false;
  }

  // ===== Acciones =====
  abrirCorte(): void {
    if (this.requiereSeleccionGimnasio) {
      this.noti.aviso('Selecciona un gimnasio para abrir corte.');
      return;
    }

    this.resetErrores();
    if (this.fondoCajaInicial == null || this.fondoCajaInicial < 0) {
      this.noti.aviso('Ingresa un fondo de caja válido.');
      return;
    }

    this.cargando = true;
    this.srv.abrir({ fondoCajaInicial: this.fondoCajaInicial })
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
          this.noti.exito('Corte abierto.');

          this.detenerWatcherCorteAbierto();
          this.cargarSalidas();
          this.refrescarPreview();
          this.refrescarDesgloseActual();
        },
        error: (e) => this.mostrarError(e, 'No se pudo abrir el corte.')
      });
  }

  cerrarCorte(): void {
    if (this.requiereSeleccionGimnasio) {
      this.noti.aviso('Selecciona un gimnasio.');
      return;
    }
    if (!this.corte?.idCorte) return;

    this.resetErrores();

    const req: CerrarCorte = {
      hasta: this.fechaLocalDateTime(),
      efectivoEntregado: this.efectivoEntregado ?? undefined,
      efectivoEnCajaConteo: this.efectivoEnCajaConteo ?? undefined,
    };

    this.cargando = true;
    this.srv.cerrar(this.corte.idCorte, req)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.corte = this.normalizarCorte(resp);
          this.borrarCortePersistidoPorTenant();
          this.noti.exito('Corte cerrado.');

          this.preview = null;
          this.desglose = null;
          this.movimientos = [];
          this.modalMovimientosAbierto = false;

          try { this.imprimirTicketCorte(this.corte!); } catch {}

          this.iniciarWatcherCorteAbierto();
        },
        error: (e) => this.mostrarError(e, 'No se pudo cerrar el corte.')
      });
  }

  registrarSalida(): void {
    if (this.requiereSeleccionGimnasio) {
      this.noti.aviso('Selecciona un gimnasio.');
      return;
    }
    if (!this.corte?.idCorte) return;

    if (!this.salidaConcepto || !this.salidaMonto || this.salidaMonto <= 0) {
      this.noti.aviso('Completa concepto y monto válido.');
      return;
    }

    this.cargarUsuarioDesdeStorageYToken();

    const req: RegistrarSalidaEfectivoRequest = {
      concepto: this.salidaConcepto.trim(),
      monto: this.salidaMonto,
    };

    this.resetErrores();
    this.cargando = true;

    this.srv.registrarSalida(this.corte.idCorte, req)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp: any) => {
          this.noti.exito('Salida registrada.');
          this.imprimirSalidaDespuesDeRegistrar(req, resp);

          this.salidaConcepto = '';
          this.salidaMonto = null;

          this.cargarSalidas();
          this.refrescarPreview();
          this.refrescarDesgloseActual();
        },
        error: (e) => this.mostrarError(e, 'No se pudo registrar la salida.')
      });
  }

  // ===== Preview =====
  refrescarPreview(): void {
    if (this.requiereSeleccionGimnasio) { this.preview = null; return; }
    if (!this.corte?.idCorte || this.corte.estado !== 'ABIERTO') { this.preview = null; return; }

    this.srv.previsualizar(this.corte.idCorte).subscribe({
      next: (p) => this.preview = p,
      error: () => {}
    });
  }

  // ===== Desglose actual =====
  refrescarDesgloseActual(): void {
    if (this.requiereSeleccionGimnasio) {
      this.desglose = null;
      this.movimientos = [];
      return;
    }

    if (!this.estaAbierto) {
      this.desglose = null;
      this.movimientos = [];
      return;
    }

    this.cargandoDesglose = true;
    this.srv.desgloseActual()
      .pipe(finalize(() => (this.cargandoDesglose = false)))
      .subscribe({
        next: (resp) => {
          this.desglose = resp ?? null;

          if (resp?.corte) {
            this.corte = this.normalizarCorte(resp.corte);
            this.persistirCortePorTenant(resp.corte.idCorte);
          }

          this.movimientos = (resp?.movimientos ?? []).slice();
          this.salidas = resp?.salidas ?? this.salidas ?? [];
        },
        error: () => {
          this.desglose = null;
          this.movimientos = [];
        }
      });
  }

  private cargarSalidas(): void {
    if (this.requiereSeleccionGimnasio) { this.salidas = []; return; }
    if (!this.corte?.idCorte) { this.salidas = []; return; }

    this.srv.listarSalidas(this.corte.idCorte).subscribe({
      next: (arr) => this.salidas = arr,
      error: () => { this.salidas = []; }
    });
  }

  private autocargarCorteAbierto(): void {
    if (this.requiereSeleccionGimnasio) return;

    this.cargando = true;
    this.srv.consultarAbierto()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          if (!resp) {
            this.iniciarWatcherCorteAbierto();
            return;
          }

          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);

          this.detenerWatcherCorteAbierto();
          this.cargarSalidas();
          this.refrescarPreview();
          this.refrescarDesgloseActual();
        },
        error: (e) => {
          this.mostrarError(e, 'No se pudo obtener el corte abierto.');
          this.iniciarWatcherCorteAbierto();
        }
      });
  }

  private cargarCortePorId(id: number, fallbackToAbierto = false): void {
    if (this.requiereSeleccionGimnasio) return;

    this.resetErrores();
    this.cargando = true;
    this.srv.consultar(id)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
          this.cargarSalidas();

          if (this.corte.estado === 'ABIERTO') {
            this.detenerWatcherCorteAbierto();
            this.refrescarPreview();
            this.refrescarDesgloseActual();
          } else {
            this.preview = null;
            this.desglose = null;
            this.movimientos = [];
            if (fallbackToAbierto) this.autocargarCorteAbierto();
          }
        },
        error: (e) => {
          this.mostrarError(e, 'No se pudo consultar el corte.');
          if (fallbackToAbierto) this.autocargarCorteAbierto();
        }
      });
  }

  // ===== Watcher =====
  private iniciarWatcherCorteAbierto(): void {
    if (this.requiereSeleccionGimnasio) return;
    if (this.watchOpenId) return;

    this.watchOpenId = setInterval(() => {
      if (this.requiereSeleccionGimnasio) return;
      if (this.estaAbierto) return;

      this.srv.consultarAbierto().subscribe({
        next: (resp) => {
          if (!resp) return;

          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);

          this.detenerWatcherCorteAbierto();
          this.cargarSalidas();
          this.refrescarPreview();
          this.refrescarDesgloseActual();
        },
        error: () => {}
      });
    }, 12000);
  }

  private detenerWatcherCorteAbierto(): void {
    if (this.watchOpenId) {
      clearInterval(this.watchOpenId);
      this.watchOpenId = null;
    }
  }

  // ===== Helpers =====
  get estaAbierto(): boolean { return (this.corte?.estado ?? '') === 'ABIERTO'; }

  get totalGeneralLive(): number {
    const v = Number(this.preview?.totalGeneral ?? this.corte?.totalGeneral ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  private normalizarCorte(resp: CorteCajaResponseDTO): CorteCajaResponseDTO {
    const desgloses = resp?.desgloses ?? [];
    const sumar = (origen: OrigenCorte) =>
      desgloses
        .filter(d => d?.origen === origen && typeof d?.total === 'number')
        .reduce((acc, d) => acc + (d.total || 0), 0);

    const tv = (typeof resp.totalVentas === 'number' ? resp.totalVentas : sumar('VENTA'));
    const tm = (typeof resp.totalMembresias === 'number' ? resp.totalMembresias : sumar('MEMBRESIA'));
    const ta = (typeof resp.totalAccesorias === 'number' ? resp.totalAccesorias : sumar('ACCESORIA'));
    const tg = (typeof resp.totalGeneral === 'number' ? resp.totalGeneral : (tv + tm + ta));

    return { ...resp, totalVentas: tv, totalMembresias: tm, totalAccesorias: ta, totalGeneral: tg };
  }

  // ===== Usuario logueado =====
  private cargarUsuarioDesdeStorageYToken(): void {
    const uStorage = (sessionStorage.getItem('username') ?? '').trim();
    if (uStorage) { this.usuarioLogueado = uStorage; return; }

    const token = this.tokenActual();
    if (!token) { this.usuarioLogueado = ''; return; }

    try {
      const d: any = this.jwt.decodeToken(token) || {};
      this.usuarioLogueado = String(
        d?.preferred_username ??
        d?.nombreUsuario ??
        d?.username ??
        d?.name ??
        d?.email ??
        d?.sub ??
        ''
      ).trim();
    } catch {
      this.usuarioLogueado = '';
    }
  }

  private tokenActual(): string {
    const keys = [environment.TOKEN_NAME, 'access_token', 'token', 'id_token']
      .filter(Boolean) as string[];

    for (const k of keys) {
      const raw = (sessionStorage.getItem(k) ?? localStorage.getItem(k) ?? '').trim();
      if (raw) return raw.replace(/^Bearer\s+/i, '').trim();
    }
    return '';
  }

  // ✅ aquí definimos admin desde token (como tu TenantContextService)
  private isAdminFromToken(): boolean {
  const token = this.tokenActual();
  if (!token) return false;

  try {
    const d: any = this.jwt.decodeToken(token) || {};
    const auths = d?.authorities ?? d?.roles ?? [];
    const arr = Array.isArray(auths) ? auths : [auths];

    return arr.some((x: any) => {
      const raw = (typeof x === 'string') ? x : (x?.authority ?? x?.name ?? x?.rol ?? '');
      const r = String(raw ?? '').trim().toUpperCase();
      return r === 'ADMIN' || r === 'ROLE_ADMIN';
    });
  } catch {
    return false;
  }
}


  private fechaLocalDateTime(d = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      + `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private resetErrores(): void { this.error = null; }

  private mostrarError(e: any, porDefecto: string): void {
    console.error('[CorteCaja] error', e);
    const msg = this.mensajeAmigableError(e, porDefecto);
    this.error = msg;
    this.noti.error(msg);
  }

  private mensajeAmigableError(e: any, fallback: string): string {
    const raw =
      e?.error?.message ??
      e?.error?.error ??
      e?.error ??
      e?.message ??
      '';

    let s = '';
    if (typeof raw === 'string') s = raw;
    else {
      try { s = JSON.stringify(raw); } catch { s = String(raw ?? ''); }
    }

    s = (s || '').trim();
    s = s.replace(/Http failure response for\s+[^:]+:\s*/i, '').trim();
    s = s.replace(/^Error:\s*/i, '').trim();

    const isNoise = !s || /http failure/i.test(s) || /unknown error/i.test(s) || s.length > 180;
    return isNoise ? fallback : s;
  }

  // ===== Persistencia por tenant =====
  private tenantIdDesdeStorageOToken(): number | null {
    const t = sessionStorage.getItem('tenantId');
    if (t != null && t !== '') {
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    }

    const token = this.tokenActual();
    if (!token) return null;

    try {
      const decoded: any = this.jwt.decodeToken(token) || {};
      const tenantId = decoded?.tenantId ?? decoded?.gimnasioId ?? decoded?.id_gimnasio ?? null;
      const n = Number(tenantId);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  private claveTenant(): string | null {
    const tid = this.tenantSeleccionado;
    if (tid == null) return null; // ADMIN "Todos" => no persistimos corte
    return `corteActualId@tenant:${tid}`;
  }

  private persistirCortePorTenant(id: number): void {
    const key = this.claveTenant();
    if (key) sessionStorage.setItem(key, String(id));
  }

  private obtenerCortePersistidoPorTenant(): number | null {
    const key = this.claveTenant();
    if (!key) return null;
    const raw = sessionStorage.getItem(key);
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) ? id : null;
  }

  private borrarCortePersistidoPorTenant(): void {
    const key = this.claveTenant();
    if (key) sessionStorage.removeItem(key);
  }

  // ===== impresión (si ya lo tienes en tu clase, déjalo igual) =====
  private imprimirTicketCorte(corte: CorteCajaResponseDTO): void {
    const gym: any = (corte as any)?.gimnasio ?? {};
    const negocio = {
      nombre: gym?.nombre || 'REVOLUCIÓN ATLÉTICA',
      direccion: gym?.direccion || '',
      telefono: gym?.telefono || ''
    };

    this.cargarUsuarioDesdeStorageYToken();
    const cajero = (this.usuarioLogueado ?? '').trim();

    this.ticket.imprimirCorteDesdeBackend(corte as any, {
      negocio,
      cajero,
      brandTitle: 'REVOLUCIÓN ATLÉTICA'
    });
  }

  private imprimirSalidaDespuesDeRegistrar(req: RegistrarSalidaEfectivoRequest, resp: any): void {
    // deja tu implementación si ya la tenías; aquí no afecta al filtrado
    try { /* no-op */ } catch {}
  }
  get formasPagoAgrupadasPreview(): Array<{ tipo: string; operaciones: number; total: number }> {
  const map = new Map<string, { operaciones: number; total: number }>();
  const lista = (this.preview as any)?.formasDePago ?? (this.preview as any)?.formasPago ?? [];

  for (const it of lista) {
    const key = String((it as any)?.tipoPago ?? '');
    const prev = map.get(key) ?? { operaciones: 0, total: 0 };
    prev.operaciones += Number((it as any)?.operaciones ?? 0);
    prev.total += Number((it as any)?.total ?? 0);
    map.set(key, prev);
  }

  const orden = ['EFECTIVO','TARJETA','TRANSFERENCIA','SPEI','DEPOSITO','MIXTO','OTRO'];
  const arr = Array.from(map.entries()).map(([tipo, v]) => ({ tipo, ...v }));

  arr.sort((a,b) => {
    const ia = orden.indexOf(a.tipo); const ib = orden.indexOf(b.tipo);
    const sa = ia === -1 ? 999 : ia;  const sb = ib === -1 ? 999 : ib;
    return sa === sb ? a.tipo.localeCompare(b.tipo) : sa - sb;
  });

  return arr;
}

}
