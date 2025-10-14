import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';

import { CorteCajaService } from '../../services/corte-caja-service';
import { NotificacionService } from '../../services/notificacion-service';
import { CorteCajaResponseDTO, CerrarCorte, ResumenPagoDTO, OrigenCorte } from '../../model/corte-caja-data';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-corte-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './corte-caja.html',
  styleUrl: './corte-caja.css',
})
export class CorteCaja implements OnInit {
  // ───────────────── Estado de vista ─────────────────
  corte: CorteCajaResponseDTO | null = null;
  cargando = false;
  error: string | null = null;

  // ───────────────── Inyección ───────────────────────
  private srv = inject(CorteCajaService);
  private noti = inject(NotificacionService);
  private jwt  = inject(JwtHelperService);

  // ───────────────── Ciclo de vida ───────────────────
  ngOnInit(): void {
    const idPersistido = this.obtenerCortePersistidoPorTenant();
    if (idPersistido != null) {
      this.cargarCortePorId(idPersistido);
      return;
    }
    this.autocargarCorteAbierto();
  }

  // ───────────────── Acciones ────────────────────────
  abrirCorte(): void {
    this.resetErrores();
    this.cargando = true;

    this.srv.abrir()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
          this.noti.exito('Corte abierto.');
        },
        error: (e) => this.mostrarError(e, 'No se pudo abrir el corte.')
      });
  }

  cerrarCorte(): void {
    if (!this.corte?.idCorte) return;

    this.resetErrores();
    const req: CerrarCorte = { hasta: this.fechaLocalDateTime() };
    this.cargando = true;

    this.srv.cerrar(this.corte.idCorte, req)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.corte = this.normalizarCorte(resp); // mantener resumen consistente
          this.borrarCortePersistidoPorTenant();
          this.noti.exito('Corte cerrado.');
        },
        error: (e) => this.mostrarError(e, 'No se pudo cerrar el corte.')
      });
  }

  // ───────────────── Helpers de totales (fallback) ───
  private sumar(origen: OrigenCorte, arr?: ResumenPagoDTO[] | null): number {
    if (!arr?.length) return 0;
    return arr
      .filter(d => d?.origen === origen && typeof d?.total === 'number')
      .reduce((acc, d) => acc + (d.total || 0), 0);
  }

  /** Asegura que totalVentas/totalMembresias/totalAccesorias/totalGeneral existan. */
  private normalizarCorte(resp: CorteCajaResponseDTO): CorteCajaResponseDTO {
    const desgloses = resp?.desgloses ?? [];

    const tv = (typeof resp.totalVentas === 'number' ? resp.totalVentas : this.sumar('VENTA', desgloses));
    const tm = (typeof resp.totalMembresias === 'number' ? resp.totalMembresias : this.sumar('MEMBRESIA', desgloses));
    const ta = (typeof resp.totalAccesorias === 'number' ? resp.totalAccesorias : this.sumar('ACCESORIA', desgloses));

    const tg = (typeof resp.totalGeneral === 'number'
      ? resp.totalGeneral
      : (tv + tm + ta));

    return {
      ...resp,
      totalVentas: tv,
      totalMembresias: tm,
      totalAccesorias: ta,
      totalGeneral: tg
    };
  }

  // Getters para plantilla (usan lo que venga del backend o el cálculo)
  get totalVentasUI(): number {
    return this.corte?.totalVentas ?? this.sumar('VENTA', this.corte?.desgloses);
  }
  get totalMembresiasUI(): number {
    return this.corte?.totalMembresias ?? this.sumar('MEMBRESIA', this.corte?.desgloses);
  }
  get totalAccesoriasUI(): number {
    return this.corte?.totalAccesorias ?? this.sumar('ACCESORIA', this.corte?.desgloses);
  }
  get totalGeneralUI(): number {
    if (!this.corte) return 0;
    return this.corte.totalGeneral ?? (this.totalVentasUI + this.totalMembresiasUI + this.totalAccesoriasUI);
  }

  // ───────────────── Consultas internas ──────────────
  private autocargarCorteAbierto(): void {
    this.cargando = true;
    this.srv.consultarAbierto()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          if (!resp) return; // 404 silencioso (no hay corte abierto)
          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
          this.noti.info(`Corte #${resp.idCorte} abierto cargado.`);
        },
        error: (e) => this.mostrarError(e, 'No se pudo obtener el corte abierto.')
      });
  }

  private cargarCortePorId(id: number): void {
    this.resetErrores();
    this.cargando = true;

    this.srv.consultar(id)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (resp) => {
          this.corte = this.normalizarCorte(resp);
          this.persistirCortePorTenant(resp.idCorte);
        },
        error: (e) => this.mostrarError(e, 'No se pudo consultar el corte.')
      });
  }

  // ───────────────── Helpers UI ──────────────────────
  get estaAbierto(): boolean {
    return (this.corte?.estado ?? '') === 'ABIERTO';
  }
  private resetErrores(): void { this.error = null; }

  /** YYYY-MM-DDTHH:mm:ss (sin zona) para el backend */
  private fechaLocalDateTime(d = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
         + `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private mostrarError(e: any, porDefecto: string): void {
    const m = e?.error?.message ?? e?.error?.error ?? e?.message ?? porDefecto;
    this.error = m;      // panel de error en pantalla
    this.noti.error(m);  // notificación flotante
  }

  // ─────────────── Persistencia por Tenant ───────────
  private claveTenant(): string | null {
    const t = sessionStorage.getItem('tenantId');
    if (t != null) return `corteActualId@tenant:${t}`;

    const token = sessionStorage.getItem(environment.TOKEN_NAME);
    if (!token) return null;
    try {
      const decoded: any = this.jwt.decodeToken(token);
      const tenantId = decoded?.tenantId ?? decoded?.gimnasioId ?? null;
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
