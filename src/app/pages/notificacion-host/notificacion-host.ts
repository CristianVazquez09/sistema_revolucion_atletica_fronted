import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificacionService } from '../../services/notificacion-service';

@Component({
  selector: 'app-notificacion-host',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificacion-host.html',
  styleUrl: './notificacion-host.css',
})
export class NotificacionHost {
  private srv = inject(NotificacionService);

  // señal del servicio (ya la estabas usando así)
  notificaciones = this.srv.notificaciones;

  // ids expandidos para "Ver más / Ver menos"
  private expandedIds = signal<Set<number>>(new Set());

  cerrar(id: number) {
    // limpia el estado expandido al cerrar
    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    this.srv.cerrar(id);
  }

  esLargo(mensaje: string | null | undefined): boolean {
    if (!mensaje) return false;

    // criterio práctico: muchas letras o varias líneas
    const len = mensaje.trim().length;
    const lineas = mensaje.split('\n').length;

    return len > 180 || lineas > 3;
  }

  estaExpandida(id: number): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpandir(id: number): void {
    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
}
