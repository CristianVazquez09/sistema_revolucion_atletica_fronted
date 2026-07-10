import { Injectable, signal } from '@angular/core';
import { SocioData } from '../../../../shared/models/socio-data';
import { MembresiaData } from '../../../../shared/models/membresia-data';

const CLAVE_STORAGE = 'asistencia-v1';

type EstadoAsistencia = {
  idSocio: number | null;
  socio: SocioData | null;
  membresias: MembresiaData[];
};

@Injectable({ providedIn: 'root' })
export class AsistenciaStore {
  // Estado en memoria (signals)
  idSocio = signal<number | null>(null);
  socio = signal<SocioData | null>(null);
  membresias = signal<MembresiaData[]>([]);

  constructor() {
    this.cargarDeStorage();
  }

  guardarEstado(idSocio: number, socio: SocioData | null, membresias: MembresiaData[]): void {
    this.idSocio.set(idSocio);
    this.socio.set(socio);
    this.membresias.set(membresias ?? []);
    this.persistir();
  }

  limpiar(): void {
    this.idSocio.set(null);
    this.socio.set(null);
    this.membresias.set([]);
    localStorage.removeItem(CLAVE_STORAGE);
  }

  private persistir(): void {
    const data: EstadoAsistencia = {
      idSocio: this.idSocio(),
      socio: this.socio(),
      membresias: this.membresias()
    };
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(data));
  }

  private cargarDeStorage(): void {
    try {
      const raw = localStorage.getItem(CLAVE_STORAGE);
      if (!raw) return;
      const data = JSON.parse(raw) as EstadoAsistencia;
      this.idSocio.set(data?.idSocio ?? null);
      this.socio.set(data?.socio ?? null);
      this.membresias.set(data?.membresias ?? []);
    } catch {
      // si hay error, no rompemos la app
      localStorage.removeItem(CLAVE_STORAGE);
    }
  }
}
