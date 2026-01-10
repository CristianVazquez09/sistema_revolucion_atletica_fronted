import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';

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

// ✅ MODAL
import { CorteCajaModal } from './corte-caja-modal/corte-caja-modal';

@Component({
  selector: 'app-corte-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, CorteCajaModal],
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

  ngOnInit(): void {
    this.cargarUsuarioDesdeStorageYToken();

    const idPersistido = this.obtenerCortePersistidoPorTenant();

    // Si hay id persistido, lo intentamos; si falla o no está ABIERTO, caemos a consultarAbierto()
    if (idPersistido != null) {
      this.cargarCortePorId(idPersistido, true);
    } else {
      this.autocargarCorteAbierto();
    }

    // ✅ Si otro usuario abre corte mientras tú estás logueado, que se refleje solo
    this.iniciarWatcherCorteAbierto();
  }

  ngOnDestroy(): void {
    this.detenerWatcherCorteAbierto();
  }

  // ===== UI: Modal =====
  abrirModalMovimientos(): void {
    if (!this.estaAbierto) {
      this.noti.aviso('No hay corte abierto.');
      return;
    }
    this.modalMovimientosAbierto = true;

    // si aún no hay movimientos, los cargamos al abrir
    if (!this.movimientos?.length) {
      this.refrescarDesgloseActual();
    }
  }

  cerrarModalMovimientos(): void {
    this.modalMovimientosAbierto = false;
  }

  // ===== Acciones =====
  abrirCorte(): void {
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

          // ✅ al abrir, detenemos watcher (ya hay corte abierto)
          this.detenerWatcherCorteAbierto();

          this.cargarSalidas();
          this.refrescarPreview();
          this.refrescarDesgloseActual();
        },
        error: (e) => this.mostrarError(e, 'No se pudo abrir el corte.')
      });
  }

  cerrarCorte(): void {
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

          // limpia desglose + modal
          this.preview = null;
          this.desglose = null;
          this.movimientos = [];
          this.modalMovimientosAbierto = false;

          try { this.imprimirTicketCorte(this.corte!); } catch {}

          // ✅ al cerrar, volvemos a vigilar si alguien abre uno nuevo
          this.iniciarWatcherCorteAbierto();
        },
        error: (e) => this.mostrarError(e, 'No se pudo cerrar el corte.')
      });
  }

  registrarSalida(): void {
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
    if (!this.corte?.idCorte || this.corte.estado !== 'ABIERTO') {
      this.preview = null;
      return;
    }
    this.srv.previsualizar(this.corte.idCorte).subscribe({
      next: (p) => this.preview = p,
      error: () => { /* silencioso */ }
    });
  }

  // ===== Desglose actual =====
  refrescarDesgloseActual(): void {
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
    if (!this.corte?.idCorte) { this.salidas = []; return; }
    this.srv.listarSalidas(this.corte.idCorte).subscribe({
      next: (arr) => this.salidas = arr,
      error: () => { this.salidas = []; }
    });
  }

  private autocargarCorteAbierto(): void {
    this.cargando = true;
    this.srv.consultarAbierto()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          if (!resp) {
            // no hay corte: seguir vigilando por si alguien lo abre
            this.iniciarWatcherCorteAbierto();
            return;
          }

          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
          this.noti.info(`Corte #${resp.idCorte} abierto cargado.`);

          // ✅ ya hay corte, detenemos watcher
          this.detenerWatcherCorteAbierto();

          this.cargarSalidas();
          this.refrescarPreview();
          this.refrescarDesgloseActual();
        },
        error: (e) => {
          // no mostramos mega error, solo mensaje limpio
          this.mostrarError(e, 'No se pudo obtener el corte abierto.');
          this.iniciarWatcherCorteAbierto();
        }
      });
  }

  private cargarCortePorId(id: number, fallbackToAbierto = false): void {
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

  // ===== Watcher: si alguien abre corte mientras yo tengo sesión =====
  private iniciarWatcherCorteAbierto(): void {
    if (this.watchOpenId) return;

    // cada 12s (ajústalo si quieres)
    this.watchOpenId = setInterval(() => {
      if (this.estaAbierto) return;

      this.srv.consultarAbierto().subscribe({
        next: (resp) => {
          if (!resp) return;

          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);

          this.noti.info(`Se detectó corte #${resp.idCorte} abierto.`);
          this.detenerWatcherCorteAbierto();

          this.cargarSalidas();
          this.refrescarPreview();
          this.refrescarDesgloseActual();
        },
        error: () => { /* silencioso */ }
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

  // ✅ Total general LIVE (todas las formas de pago)
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

  get formasPagoAgrupadasPreview(): Array<{ tipo: string; operaciones: number; total: number }> {
    const map = new Map<string, { operaciones: number; total: number }>();
    const lista = this.preview?.formasDePago ?? [];
    for (const it of lista) {
      const key = String((it as any).tipoPago ?? '');
      const prev = map.get(key) ?? { operaciones: 0, total: 0 };
      prev.operaciones += ((it as any).operaciones ?? 0);
      prev.total += ((it as any).total ?? 0);
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

  private imprimirTicketCorte(corte: CorteCajaResponseDTO): void {
    const gym: any = (corte as any)?.gimnasio ?? {};
    const negocio = {
      nombre: gym?.nombre || 'REVOLUCIÓN ATLÉTICA',
      direccion: gym?.direccion || '',
      telefono: gym?.telefono || ''
    };

    this.cargarUsuarioDesdeStorageYToken();
    const cajero =
      this.usuarioActual() ||
      this.extraerNombreUsuario((corte as any)?.usuarioCierre) ||
      this.extraerNombreUsuario((corte as any)?.usuario) ||
      '';

    this.ticket.imprimirCorteDesdeBackend(corte as any, {
      negocio,
      cajero,
      brandTitle: 'REVOLUCIÓN ATLÉTICA'
    });
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
    const keys = [
      environment.TOKEN_NAME,
      'access_token',
      'token',
      'id_token'
    ].filter(Boolean) as string[];

    const read = (k: string) =>
      (sessionStorage.getItem(k) ?? localStorage.getItem(k) ?? '').trim();

    for (const k of keys) {
      const raw = read(k);
      if (raw) return raw.replace(/^Bearer\s+/i, '').trim();
    }
    return '';
  }

  private usuarioActual(): string {
    const cached = (this.usuarioLogueado ?? '').trim();
    if (cached) return cached;

    const u1 = (sessionStorage.getItem('username') ?? '').trim();
    if (u1) return u1;

    const token = this.tokenActual();
    if (!token) return '';

    try {
      const d: any = this.jwt.decodeToken(token) || {};
      return String(
        d?.preferred_username ??
        d?.nombreUsuario ??
        d?.username ??
        d?.name ??
        d?.email ??
        d?.sub ??
        ''
      ).trim();
    } catch {
      return '';
    }
  }

  private extraerNombreUsuario(u: any): string {
    if (!u) return '';
    if (typeof u === 'string') return u.trim();
    return String(
      u?.nombreUsuario ??
      u?.preferred_username ??
      u?.username ??
      u?.name ??
      u?.email ??
      ''
    ).trim();
  }

  private fechaLocalDateTime(d = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      + `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private resetErrores(): void { this.error = null; }

  // ✅ Errores “limpios” (sin mega texto)
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

    // quita el típico prefijo de Angular
    s = s.replace(/Http failure response for\s+[^:]+:\s*/i, '').trim();
    s = s.replace(/^Error:\s*/i, '').trim();

    // si trae URL o basura larga, usa fallback
    const isNoise =
      !s ||
      /http failure/i.test(s) ||
      /unknown error/i.test(s) ||
      s.length > 180;

    return isNoise ? fallback : s;
  }

  // ===== Impresión Salida =====
  private imprimirSalidaDespuesDeRegistrar(req: RegistrarSalidaEfectivoRequest, resp: any): void {
    if (resp && (resp?.id || resp?.idSalidaEfectivo || resp?.fecha || resp?.concepto || resp?.monto)) {
      try { this.imprimirTicketSalidaEfectivo(resp, req); } catch {}
      return;
    }

    if (!this.corte?.idCorte) {
      try { this.imprimirTicketSalidaEfectivo(null, req); } catch {}
      return;
    }

    this.srv.listarSalidas(this.corte.idCorte).subscribe({
      next: (arr: SalidaEfectivo[]) => {
        this.salidas = arr;
        const match = this.encontrarSalidaReciente(arr, req);
        try { this.imprimirTicketSalidaEfectivo(match ?? null, req); } catch {}
      },
      error: () => {
        try { this.imprimirTicketSalidaEfectivo(null, req); } catch {}
      }
    });
  }

  private encontrarSalidaReciente(arr: SalidaEfectivo[], req: RegistrarSalidaEfectivoRequest): SalidaEfectivo | null {
    const cReq = (req.concepto ?? '').trim().toLowerCase();
    const mReq = Number(req.monto ?? 0);

    const same = (s: any) => {
      const c = String(s?.concepto ?? '').trim().toLowerCase();
      const m = Number(s?.monto ?? 0);
      return c === cReq && Math.abs(m - mReq) < 0.01;
    };

    const candidatos = (arr || []).filter(same);

    const pick = (list: any[]) => {
      const getId = (x: any) =>
        Number(x?.id ?? x?.idSalidaEfectivo ?? x?.idSalida ?? NaN);

      const withId = list.filter(x => Number.isFinite(getId(x)));
      if (withId.length) return withId.sort((a,b) => getId(b) - getId(a))[0];

      return list.sort((a,b) => {
        const da = new Date(a?.fecha ?? a?.createdAt ?? 0).getTime();
        const db = new Date(b?.fecha ?? b?.createdAt ?? 0).getTime();
        return db - da;
      })[0];
    };

    if (candidatos.length) return pick(candidatos) as SalidaEfectivo;
    if (arr?.length) return pick(arr as any) as SalidaEfectivo;
    return null;
  }

  private imprimirTicketSalidaEfectivo(resp: any, req: RegistrarSalidaEfectivoRequest): void {
    const gym: any = (this.corte as any)?.gimnasio ?? {};
    const negocio = {
      nombre: gym?.nombre || 'REVOLUCIÓN ATLÉTICA',
      direccion: gym?.direccion || '',
      telefono: gym?.telefono || ''
    };

    this.cargarUsuarioDesdeStorageYToken();

    const usuario =
      this.usuarioActual() ||
      this.extraerNombreUsuario(resp?.usuarioRegistro) ||
      this.extraerNombreUsuario(resp?.usuarioRetiro) ||
      this.extraerNombreUsuario(resp?.usuario) ||
      this.extraerNombreUsuario(resp?.nombreUsuario) ||
      '—';

    const folio =
      resp?.idSalidaEfectivo ??
      resp?.idSalida ??
      resp?.id ??
      `RET-${Date.now()}`;

    const fecha = resp?.fecha ?? resp?.createdAt ?? new Date();
    const concepto = resp?.concepto ?? req?.concepto ?? 'Salida de efectivo';
    const monto = resp?.monto ?? req?.monto ?? 0;

    this.ticket.imprimirSalidaEfectivo({
      negocio,
      folio,
      fecha,
      cajero: usuario,
      idCorte: this.corte?.idCorte ?? '',
      concepto,
      monto
    });
  }

  // ===== Persistencia por tenant =====
  private claveTenant(): string | null {
    const t = sessionStorage.getItem('tenantId');
    if (t != null) return `corteActualId@tenant:${t}`;

    const token = this.tokenActual();
    if (!token) return null;

    try {
      const decoded: any = this.jwt.decodeToken(token) || {};
      const tenantId = decoded?.tenantId ?? decoded?.gimnasioId ?? decoded?.id_gimnasio ?? null;
      return tenantId != null ? `corteActualId@tenant:${tenantId}` : null;
    } catch {
      return null;
    }
  }

  private persistirCortePorTenant(id: number): void {
    const key = this.claveTenant(); if (key) sessionStorage.setItem(key, String(id));
  }

  private obtenerCortePersistidoPorTenant(): number | null {
    const key = this.claveTenant(); if (!key) return null;
    const raw = sessionStorage.getItem(key);
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) ? id : null;
  }

  private borrarCortePersistidoPorTenant(): void {
    const key = this.claveTenant(); if (key) sessionStorage.removeItem(key);
  }
}
