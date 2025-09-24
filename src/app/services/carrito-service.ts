// src/app/pages/punto-venta/carrito.service.ts
import { Injectable, computed, signal } from '@angular/core';

export interface CarritoItem {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnit: number;
}

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly itemsSig = signal<CarritoItem[]>([]);
  private readonly indiceSeleccionadoSig = signal<number | null>(null);

  readonly totalSig = computed(() =>
    this.itemsSig().reduce((acc: number, it: CarritoItem) => acc + it.cantidad * it.precioUnit, 0)
  );

  obtenerItems(): CarritoItem[] { return this.itemsSig(); }
  obtenerIndiceSeleccionado(): number | null { return this.indiceSeleccionadoSig(); }
  obtenerTotal(): number { return this.totalSig(); }

  seleccionarIndice(indice: number | null): void {
    const len: number = this.itemsSig().length;
    if (indice === null) { this.indiceSeleccionadoSig.set(null); return; }
    if (indice < 0 || indice >= len) { return; }
    this.indiceSeleccionadoSig.set(indice);
  }

  limpiar(): void {
    this.itemsSig.set([]);
    this.indiceSeleccionadoSig.set(null);
  }

  cantidadEnCarrito(idProducto: number): number {
    return this.itemsSig()
      .filter((x: CarritoItem) => x.idProducto === idProducto)
      .reduce((acc: number, it: CarritoItem) => acc + it.cantidad, 0);
  }

  agregar(idProducto: number, nombre: string, precioUnit: number, cantidad: number): void {
    if (cantidad <= 0) { return; }
    const items: CarritoItem[] = [...this.itemsSig()];
    const idx: number = items.findIndex((x: CarritoItem) => x.idProducto === idProducto);

    if (idx >= 0) {
      const existente: CarritoItem = items[idx];
      items[idx] = { ...existente, cantidad: existente.cantidad + cantidad };
      this.indiceSeleccionadoSig.set(idx);
    } else {
      items.push({ idProducto, nombre, cantidad, precioUnit });
      this.indiceSeleccionadoSig.set(items.length - 1);
    }
    this.itemsSig.set(items);
  }

  sumarSeleccionado(): void {
    const idx: number | null = this.indiceSeleccionadoSig();
    if (idx == null) { return; }
    const items: CarritoItem[] = [...this.itemsSig()];
    items[idx] = { ...items[idx], cantidad: items[idx].cantidad + 1 };
    this.itemsSig.set(items);
  }

  restarSeleccionado(): void {
    const idx: number | null = this.indiceSeleccionadoSig();
    if (idx == null) { return; }
    const items: CarritoItem[] = [...this.itemsSig()];
    const nuevo: number = Math.max(1, items[idx].cantidad - 1);
    items[idx] = { ...items[idx], cantidad: nuevo };
    this.itemsSig.set(items);
  }

  eliminarSeleccionado(): void {
    const idx: number | null = this.indiceSeleccionadoSig();
    if (idx == null) { return; }
    const items: CarritoItem[] = [...this.itemsSig()];
    items.splice(idx, 1);
    this.itemsSig.set(items);
    this.indiceSeleccionadoSig.set(null);
  }
}
