import { Injectable, signal } from '@angular/core';

/** Trackea cuál ra-dropdown está abierto en toda la app (solo uno a la vez). */
@Injectable({ providedIn: 'root' })
export class RaDropdownRegistry {
  private readonly abiertoId = signal<symbol | null>(null);

  estaAbierto(id: symbol): boolean {
    return this.abiertoId() === id;
  }

  abrir(id: symbol): void {
    this.abiertoId.set(id);
  }

  cerrarTodos(): void {
    this.abiertoId.set(null);
  }
}
