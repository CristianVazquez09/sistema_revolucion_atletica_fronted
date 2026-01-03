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
} from '../../model/corte-caja-data';
import { environment } from '../../../environments/environment';
import { TicketService } from '../../services/ticket-service';

@Component({
  selector: 'app-corte-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './corte-caja.html',
  styleUrl: './corte-caja.css',
})
export class CorteCaja implements OnInit, OnDestroy {
  corte: CorteCajaResponseDTO | null = null;
  preview: CorteCajaPreviewDTO | null = null;
  salidas: SalidaEfectivo[] = [];

  cargando = false;
  error: string | null = null;

  // Formularios
  fondoCajaInicial: number = 0;
  efectivoEntregado: number | null = null;
  efectivoEnCajaConteo: number | null = null;

  salidaConcepto = '';
  salidaMonto: number | null = null;

  // cache del usuario logueado (como en Inscripción)
  usuarioLogueado = '';

  private timerId: any = null;

  private srv = inject(CorteCajaService);
  private noti = inject(NotificacionService);
  private jwt = inject(JwtHelperService);
  private ticket = inject(TicketService);

  ngOnInit(): void {
    this.cargarUsuarioDesdeStorageYToken();

    const idPersistido = this.obtenerCortePersistidoPorTenant();
    if (idPersistido != null) {
      this.cargarCortePorId(idPersistido, false);
      return;
    }
    this.autocargarCorteAbierto();
  }

  ngOnDestroy(): void {
    this.detenerPreview();
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
          this.cargarSalidas();
          this.refrescarPreview();
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
          this.detenerPreview();
          try { this.imprimirTicketCorte(this.corte!); } catch {}
        },
        error: (e) => this.mostrarError(e, 'No se pudo cerrar el corte.')
      });
  }

  // ✅ imprime ticket al registrar salida
  registrarSalida(): void {
    if (!this.corte?.idCorte) return;

    if (!this.salidaConcepto || !this.salidaMonto || this.salidaMonto <= 0) {
      this.noti.aviso('Completa concepto y monto válido.');
      return;
    }

    // refresca usuario antes de imprimir (por si cambió storage/token)
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

          // imprime con resp si viene; si no, busca la salida recién creada
          this.imprimirSalidaDespuesDeRegistrar(req, resp);

          this.salidaConcepto = '';
          this.salidaMonto = null;

          this.cargarSalidas();
          this.refrescarPreview();
        },
        error: (e) => this.mostrarError(e, 'No se pudo registrar la salida.')
      });
  }

  // ===== Preview (manual) =====
  private detenerPreview(): void {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
  }

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
          if (!resp) return;
          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
          this.noti.info(`Corte #${resp.idCorte} abierto cargado.`);
          this.cargarSalidas();
          this.refrescarPreview();
        },
        error: (e) => this.mostrarError(e, 'No se pudo obtener el corte abierto.')
      });
  }

  private cargarCortePorId(id: number, _iniciarLive = false): void {
    this.resetErrores();
    this.cargando = true;
    this.srv.consultar(id)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
          this.cargarSalidas();
          if (this.corte.estado === 'ABIERTO') this.refrescarPreview();
        },
        error: (e) => this.mostrarError(e, 'No se pudo consultar el corte.')
      });
  }

  // ===== Helpers =====
  get estaAbierto(): boolean { return (this.corte?.estado ?? '') === 'ABIERTO'; }

  /** Agrega totales faltantes usando desgloses cuando vengan nulos del backend. */
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
      const key = String(it.tipoPago ?? '');
      const prev = map.get(key) ?? { operaciones: 0, total: 0 };
      prev.operaciones += (it.operaciones ?? 0);
      prev.total += (it.total ?? 0);
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

  // ===== Usuario logueado (igual patrón que Inscripción, pero robusto) =====

  private cargarUsuarioDesdeStorageYToken(): void {
    // 1) prioridad: username en sessionStorage (en tus logs existe)
    const uStorage = (sessionStorage.getItem('username') ?? '').trim();
    if (uStorage) { this.usuarioLogueado = uStorage; return; }

    // 2) token decode
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

  private mostrarError(e: any, porDefecto: string): void {
    const m = e?.error?.message ?? e?.error?.error ?? e?.message ?? porDefecto;
    this.error = m;
    this.noti.error(m);
  }

  // ===== Impresión Salida =====
  private imprimirSalidaDespuesDeRegistrar(req: RegistrarSalidaEfectivoRequest, resp: any): void {
    // Si el backend devolvió info, imprime directo
    if (resp && (resp?.id || resp?.idSalidaEfectivo || resp?.fecha || resp?.concepto || resp?.monto)) {
      try { this.imprimirTicketSalidaEfectivo(resp, req); } catch {}
      return;
    }

    // Si NO devuelve body, buscamos la salida más reciente y la imprimimos
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

    // fuerza a leer al logueado (tu caso)
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
      cajero: usuario, // aquí va el usuario que retiró
      idCorte: this.corte?.idCorte ?? '',
      concepto,
      monto
    });
  }

  // ===== Persistencia por tenant =====
  private claveTenant(): string | null {
    const t = sessionStorage.getItem('tenantId');
    if (t != null) return `corteActualId@tenant:${t}`;

    const token = this.tokenActual(); // ✅ usa el mismo método robusto
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
