// src/app/core/fingerprint.service.ts
import { Injectable } from '@angular/core';
// Importa SOLO tipos/clases del paquete (se ejecuta en renderer)
import { FingerprintReader, SampleFormat } from '@digitalpersona/devices';

type SamplesAcquiredEvent = { samples: string[] };
type QualityEvent = { quality: number };

@Injectable({ providedIn: 'root' })
export class FingerprintService {
  private reader: FingerprintReader | null = null;

  init() {
    // El WebSdk ya fue cargado por <script> en index.html
    // Aquí solo instanciamos el reader JS
    this.reader = new FingerprintReader();
  }

  /** Empieza la captura (elige el formato según tu caso) */
  async start(format: SampleFormat = SampleFormat.PngImage) {
    if (!this.reader) this.init();
    await this.reader!.startAcquisition(format);
  }

  async stop() {
    if (!this.reader) return;
    await this.reader.stopAcquisition();
  }

  /** Suscripción a eventos */
  onSamples(cb: (samples: string[]) => void) {
    if (!this.reader) this.init();
    (this.reader as any).on('SamplesAcquired', (ev: SamplesAcquiredEvent) => {
      cb(ev.samples);
    });
  }

  onQuality(cb: (quality: number) => void) {
    if (!this.reader) this.init();
    (this.reader as any).on('QualityReported', (ev: QualityEvent) => {
      cb(ev.quality);
    });
  }

  onDeviceConnected(cb: () => void) {
    if (!this.reader) this.init();
    (this.reader as any).on('DeviceConnected', cb);
  }

  onDeviceDisconnected(cb: () => void) {
    if (!this.reader) this.init();
    (this.reader as any).on('DeviceDisconnected', cb);
  }

  onError(cb: (err: any) => void) {
    if (!this.reader) this.init();
    (this.reader as any).on('ErrorOccurred', cb);
  }
}
