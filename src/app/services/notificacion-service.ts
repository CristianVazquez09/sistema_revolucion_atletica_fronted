import { Injectable, signal } from '@angular/core';

export type NotiTipo = 'exito' | 'error' | 'info' | 'aviso';

export interface Notificacion {
  id: number;
  tipo: NotiTipo;
  mensaje: string;
  titulo?: string;
  duracion: number; // ms
}

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private _notificaciones = signal<Notificacion[]>([]);
  notificaciones = this._notificaciones.asReadonly();
  private seq = 0;

  // Método base
  abrir(opts: Partial<Notificacion> & { mensaje: string; tipo?: NotiTipo }) {
    const n: Notificacion = {
      id: ++this.seq,
      tipo: opts.tipo ?? 'info',
      mensaje: opts.mensaje,
      titulo: opts.titulo,
      duracion: opts.duracion ?? 5000,
    };
    this._notificaciones.update(lst => [...lst, n]);
    setTimeout(() => this.cerrar(n.id), n.duracion);
    return n.id;
  }

  // Atajos en español
  exito(mensaje: string, opts: Partial<Notificacion> = {}) { return this.abrir({ tipo: 'exito', mensaje, ...opts }); }
  error(mensaje: string, opts: Partial<Notificacion> = {}) { return this.abrir({ tipo: 'error', mensaje, ...opts }); }
  info(mensaje: string,  opts: Partial<Notificacion> = {}) { return this.abrir({ tipo: 'info',  mensaje, ...opts }); }
  aviso(mensaje: string,  opts: Partial<Notificacion> = {}) { return this.abrir({ tipo: 'aviso', mensaje, ...opts }); }

  cerrar(id: number) { this._notificaciones.update(lst => lst.filter(n => n.id !== id)); }
  limpiar() { this._notificaciones.set([]); }
}
