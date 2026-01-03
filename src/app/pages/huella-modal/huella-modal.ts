// src/app/shared/huella/huella-modal.ts
import { Component, EventEmitter, OnDestroy, OnInit, Output, signal, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SampleFormat } from '@digitalpersona/devices';
import { getHuellaReaderSingleton } from './huella-reader-singleton';

export type HuellaResultado = {
  formato: 'PNG';
  muestras: string[];   // base64 SIN prefijo
  calidades: number[];  // códigos de calidad (0 = OK)
};

@Component({
  selector: 'app-huella-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './huella-modal.html',
  styleUrls: ['./huella.css'],
})
export class HuellaModal implements OnInit, OnDestroy {
  @Output() cancelar  = new EventEmitter<void>();
  @Output() confirmar = new EventEmitter<HuellaResultado>();

  /** cuántas muestras necesitas (1 = one-shot y cierra solo). */
  @Input() maxMuestras = 1;

  /** tiempo máximo (ms) esperando una muestra antes de reintentar/parar defensivo */
  @Input() timeoutMs = 30_000;

  private reader = getHuellaReaderSingleton();

  // Estado UI
  capturando = signal(false);
  errorMsg   = signal<string|null>(null);
  calidad    = signal<number|null>(null);

  previews   = signal<string[]>([]);
  bases64    = signal<string[]>([]);
  calidades  = signal<number[]>([]);

  private acquisitionOn = false;       // guard contra doble start
  private timeoutHandle: any = null;   // timeout defensivo

  // ====== Handlers nombrados (para off(event, handler)) ======
  private onDeviceConnected    = () => this.errorMsg.set(null);
  private onDeviceDisconnected = () => this.errorMsg.set('Lector desconectado.');
  private onErrorOccurred      = (err: any) => {
    console.error('[HuellaModal] ErrorOccurred:', err);
    this.errorMsg.set('No se puede conectar al lector. ¿Agent/Lite Client instalado?');
  };
  private onQualityReported    = (ev: { quality: number }) => {
    this.calidad.set(ev?.quality ?? null);
  };
  private onSamplesAcquired    = (ev: { samples: string[] }) => {
    try {
      const raw = ev?.samples?.[0] ?? '';
      const base = this.normalizaBase64(raw);
      if (!base) {
        this.errorMsg.set('La muestra recibida no es PNG válido.');
        return;
      }

      const q = this.calidad();
      if (!this.esCalidadAceptable(q)) {
        this.errorMsg.set(`Calidad no aceptable (${this.calidadTexto(q)}). Intenta otra vez.`);
        return;
      }

      const dataUrl = `data:image/png;base64,${base}`;
      this.previews.update(arr  => [...arr, dataUrl]);
      this.bases64.update(arr    => [...arr, base]);
      this.calidades.update(arr  => [...arr, q ?? -1]);

      if (this.bases64().length >= this.maxMuestras) {
        this.finalizar(); // cierra solo si ya juntaste las muestras
      } else {
        this.errorMsg.set(null);
        // reinicia timeout para la siguiente
        this.resetTimeout();
      }
    } catch (e) {
      console.error('[HuellaModal] onSamplesAcquired error:', e);
      this.errorMsg.set('Error procesando la muestra.');
    }
  };

  // ====== Ciclo de vida ======
  async ngOnInit() {
    try {
      (this.reader as any).on('DeviceConnected',    this.onDeviceConnected);
      (this.reader as any).on('DeviceDisconnected', this.onDeviceDisconnected);
      (this.reader as any).on('ErrorOccurred',      this.onErrorOccurred);
      (this.reader as any).on('QualityReported',    this.onQualityReported);
      (this.reader as any).on('SamplesAcquired',    this.onSamplesAcquired);

      await this.start();
    } catch (e) {
      console.error('[HuellaModal] init error:', e);
      this.errorMsg.set('Error inicializando el lector.');
    }
  }

  ngOnDestroy(): void {
    this.clearTimeout();
    this.stop().catch(() => {});
    try {
      (this.reader as any)?.off?.('DeviceConnected',    this.onDeviceConnected);
      (this.reader as any)?.off?.('DeviceDisconnected', this.onDeviceDisconnected);
      (this.reader as any)?.off?.('ErrorOccurred',      this.onErrorOccurred);
      (this.reader as any)?.off?.('QualityReported',    this.onQualityReported);
      (this.reader as any)?.off?.('SamplesAcquired',    this.onSamplesAcquired);
    } catch {}
  }

  // ====== Control de captura ======
  async start() {
    if (!this.reader || this.acquisitionOn) return;
    this.capturando.set(true);
    this.errorMsg.set(null);
    try {
      this.acquisitionOn = true;
      // Pide PNG directo (más simple para UI)
      await (this.reader as any).startAcquisition(SampleFormat.PngImage);
      this.resetTimeout();
    } catch (e) {
      console.error('[HuellaModal] start error:', e);
      this.errorMsg.set('No se pudo iniciar la captura.');
      this.capturando.set(false);
      this.acquisitionOn = false;
    }
  }

  async stop() {
    if (!this.reader) return;
    this.clearTimeout();
    try { await (this.reader as any).stopAcquisition(); } catch {}
    this.capturando.set(false);
    this.acquisitionOn = false;
  }

  private resetTimeout() {
    this.clearTimeout();
    if (this.timeoutMs > 0) {
      this.timeoutHandle = setTimeout(async () => {
        console.warn('[HuellaModal] Timeout de captura alcanzado. Reiniciando…');
        await this.stop();
        // Mensaje y opción de reintentar
        this.errorMsg.set('Se agotó el tiempo de captura. Intenta de nuevo.');
      }, this.timeoutMs);
    }
  }

  private clearTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  // ====== Acciones UI ======
  async reintentar() {
    await this.stop(); // detener SIEMPRE la sesión vigente
    this.previews.set([]);
    this.bases64.set([]);
    this.calidades.set([]);
    await this.start(); // iniciar una nueva sesión limpia
  }

  async cerrar() {
    await this.stop();
    this.cancelar.emit();
  }

  async finalizar() {
    await this.stop();
    this.confirmar.emit({
      formato: 'PNG',
      muestras: this.bases64(),
      calidades: this.calidades()
    });
  }

  // ====== Utilidades ======
  private esCalidadAceptable(q: number | null | undefined): boolean {
    return q == null || q === 0; // 0 = GOOD
  }

  private calidadTexto(q: number | null | undefined): string {
    if (q == null) return 'sin dato (OK)';
    switch (q) {
      case 0:  return 'OK';
      case 1:  return 'dedo seco / poca señal';
      case 2:  return 'dedo húmedo';
      case 3:  return 'presión muy ligera';
      case 4:  return 'presión muy fuerte';
      case 5:  return 'ruido / movimiento';
      default: return `código ${q}`;
    }
  }

  private normalizaBase64(raw: string): string {
    if (!raw) return '';
    let base = raw.trim()
      .replace(/^data:image\/png;base64,?/i,'')
      .replace(/\s+/g,'');
    base = base.replace(/-/g,'+').replace(/_/g,'/');
    base = base.replace(/[^A-Za-z0-9+/=]/g,'');
    const mod = base.length % 4; if (mod) base += '='.repeat(4 - mod);
    return base;
  }
}
