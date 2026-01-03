import {
  Component, EventEmitter, Input, OnInit, Output,
  inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { VentaService } from '../../../../services/venta-service';
import { VentaData } from '../../../../model/venta-data';
import { PagoData } from '../../../../model/membresia-data';
import { ProductoService } from '../../../../services/producto-service';
import { ProductoData } from '../../../../model/producto-data';

/* ----------------------------- Tipos internos ------------------------------ */

type EditDetalle = {
  _key: string;                  // clave única (para trackear en el template)
  idDetalle: number;             // 0 si es nuevo
  idProducto: number;
  nombreProducto: string;
  precioUnit: number;
  cantidad: number;

  // flags/cambios en edición
  productoNuevoId?: number | null;
  _changedCantidad?: boolean;
  _deleted?: boolean;
  _add?: boolean;
};

/* -------------------------------- Componente -------------------------------- */

@Component({
  selector: 'app-ventas-admin-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas-admin-modal.html',
  styleUrl: './ventas-admin-modal.css'
})
export class VentasAdminModal implements OnInit {
  /* Inputs/Outputs */
  @Input() idVenta!: number;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<VentaData>();

  /* Inyección de servicios */
  private srv = inject(VentaService);
  private productoSrv = inject(ProductoService);

  protected readonly Math = Math;

  /* ----------------------------- Estado principal ----------------------------- */
  data: VentaData | null = null;
  cargando = true;
  guardando = false;
  error: string | null = null;

  // Catálogo de productos para combos
  productos = signal<ProductoData[]>([]);
  productosCargando = true;

  private productosById = computed(() => {
    const map = new Map<number, ProductoData>();
    for (const p of (this.productos() ?? [])) {
      const id = Number((p as any).idProducto ?? (p as any).id ?? 0);
      if (id) map.set(id, p);
    }
    return map;
  });

  // detalles editables
  private _detalles = signal<EditDetalle[]>([]);
  detalles = this._detalles;
  detallesVisibles = computed(() => (this._detalles() ?? []).filter(d => !d._deleted));
  private newCtr = 0;

  // pagos (signals)
  efectivo = signal(0);
  tarjeta = signal(0);
  transferencia = signal(0);

  // inputs para "agregar producto" (ahora dropdown)
  nuevoProductoId: number | null = null;
  nuevoCantidad = 1;

  /* --------------------------------- Ciclo de vida --------------------------------- */
  ngOnInit(): void {
    if (this.idVenta == null) {
      this.error = 'Falta idVenta.';
      this.cargando = false;
      return;
    }

    // 1) cargar catálogo de productos (para dropdowns)
    this.productoSrv.buscarTodos()
      .pipe(catchError(() => of([] as ProductoData[])))
      .subscribe({
        next: (list) => this.productos.set(list ?? []),
        complete: () => (this.productosCargando = false)
      });

    // 2) cargar venta
    this.srv.buscarPorId(this.idVenta).subscribe({
      next: (v) => {
        this.data = v;
        this.mapDetallesDesdeVenta(v);
        this.mapPagosDesdeVenta(v);
        this.cargando = false;
        this.proposeIfEmpty();
      },
      error: () => {
        this.error = 'No se pudo cargar la venta.';
        this.cargando = false;
      }
    });
  }

  /* ---------------------------------- Mapeos ---------------------------------- */

  private mapPagosDesdeVenta(v: VentaData) {
    const sum = (tipo: string) =>
      (v.pagos ?? [])
        .filter(p => (p as any).tipoPago === tipo)
        .reduce((a, p) => a + Number((p as any).monto || 0), 0);

    this.efectivo.set(sum('EFECTIVO'));
    this.tarjeta.set(sum('TARJETA'));
    this.transferencia.set(sum('TRANSFERENCIA'));
  }

  private mapDetallesDesdeVenta(v: VentaData) {
    const editables: EditDetalle[] = (v.detalles ?? []).map(det => {
      const idDet = Number((det as any).idDetalleVenta ?? (det as any).idDetalle ?? 0);
      const q = Math.max(1, Number((det as any).cantidad ?? 1));
      const sub = (det as any).subTotal ?? (det as any).subtotal;

      const unit = sub != null
        ? Number(sub) / q
        : Number((det as any).precioUnit ?? (det.producto as any)?.precioVenta ?? (det as any).precio ?? 0);

      return {
        _key: `det-${idDet || cryptoRandomKey()}`,
        idDetalle: idDet,
        idProducto: Number((det.producto as any)?.idProducto ?? (det as any).idProducto ?? 0),
        nombreProducto: String((det.producto as any)?.nombre ?? (det as any).nombreProducto ?? ''),
        precioUnit: Number(unit),
        cantidad: q,
        productoNuevoId: null
      };
    });

    this._detalles.set(editables);
  }

  /* -------------------------------- Utilidades -------------------------------- */

  private genKey(): string {
    this.newCtr++;
    return `new-${Date.now()}-${this.newCtr}`;
  }

  private toInt(n: number): number {
    return Math.trunc(Number(n || 0));
  }

  private almostEq(a: number, b: number, eps = 0.01): boolean {
    return Math.abs(a - b) <= eps;
  }

  private round2(n: number): number {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  private proposeIfEmpty() {
    if ((this.efectivo() + this.tarjeta() + this.transferencia()) === 0) {
      this.efectivo.set(this.totalCalculadoVista());
    }
  }

  // helpers producto
  labelProducto(p: ProductoData): string {
    const id = Number((p as any).idProducto ?? (p as any).id ?? 0);
    const nombre = String((p as any).nombre ?? '(sin nombre)');
    const precio = Number((p as any).precioVenta ?? (p as any).precio ?? 0);
    const precioTxt = isFinite(precio) && precio > 0 ? ` - $${precio.toFixed(2)}` : '';
    return `#${id} ${nombre}${precioTxt}`;
  }

  private productoCache(id: number): ProductoData | null {
    return this.productosById().get(Number(id)) ?? null;
  }

  /* --------------------------- Totales y validaciones --------------------------- */

  totalCalculadoVista = computed(() =>
    this._detalles()
      .filter(d => !d._deleted)
      .reduce((acc, d) => acc + (Number(d.precioUnit) * this.toInt(d.cantidad)), 0)
  );

  sumaPagos = computed(() =>
    Number(this.efectivo() || 0) + Number(this.tarjeta() || 0) + Number(this.transferencia() || 0)
  );

  desbalance = computed(() => this.sumaPagos() - this.totalCalculadoVista());

  unknownPrice = computed(() =>
    this._detalles()
      .filter(d => !d._deleted)
      .some(d => !isFinite(Number(d.precioUnit)) || Number(d.precioUnit) <= 0)
  );

  canSave = computed(() =>
    !this.cargando &&
    !this.guardando &&
    !this.unknownPrice() &&
    this.almostEq(this.sumaPagos(), this.totalCalculadoVista())
  );

  /* ----------------------------- Acciones de Detalle ----------------------------- */

  incCantidad(d: EditDetalle) {
    d.cantidad = this.toInt(d.cantidad) + 1;
    d._changedCantidad = d.idDetalle > 0;
    this._detalles.set([...this._detalles()]);
    this.proposeIfEmpty();
  }

  decCantidad(d: EditDetalle) {
    const next = Math.max(1, this.toInt(d.cantidad) - 1);
    if (next !== d.cantidad) {
      d.cantidad = next;
      d._changedCantidad = d.idDetalle > 0;
      this._detalles.set([...this._detalles()]);
      this.proposeIfEmpty();
    }
  }

  onCantidadDirecta(d: EditDetalle, raw: any) {
    const val = this.toInt(Number(raw));
    const next = Math.max(1, val);
    if (next !== d.cantidad) {
      d.cantidad = next;
      d._changedCantidad = d.idDetalle > 0;
      this._detalles.set([...this._detalles()]);
      this.proposeIfEmpty();
    }
  }

  eliminarDetalle(d: EditDetalle) {
    if (d.idDetalle === 0 && d._add) {
      // nuevo -> eliminar de una vez
      this._detalles.set(this._detalles().filter(x => x._key !== d._key));
    } else {
      // existente -> marcar borrado, PERO ya no se renderiza (detallesVisibles)
      d._deleted = true;
      this._detalles.set([...this._detalles()]);
    }
    this.proposeIfEmpty();
  }

  setProductoNuevo(d: EditDetalle, idNuevo: number | null) {
    d.productoNuevoId = idNuevo ?? null;

    if (!idNuevo) {
      this._detalles.set([...this._detalles()]);
      return;
    }

    // 1) usa caché si ya cargamos productos
    const cached = this.productoCache(Number(idNuevo));
    if (cached) {
      d.nombreProducto = `${(cached as any).nombre ?? '(sin nombre)'} (nuevo)`;
      d.precioUnit = Number((cached as any).precioVenta ?? (cached as any).precio ?? 0);
      this._detalles.set([...this._detalles()]);
      return;
    }

    // 2) fallback: pedir al backend
    this.productoSrv.buscarPorId(Number(idNuevo)).subscribe({
      next: (prod: any) => {
        d.nombreProducto = `${prod?.nombre ?? '(sin nombre)'} (nuevo)`;
        d.precioUnit = Number(prod?.precioVenta ?? prod?.precio ?? 0);
        this._detalles.set([...this._detalles()]);
      },
      error: () => {
        d.nombreProducto = '(producto no encontrado)';
        d.precioUnit = NaN as any;
        this._detalles.set([...this._detalles()]);
      }
    });
  }

  agregarDetalle() {
    const id = Number(this.nuevoProductoId || 0);
    const qty = this.toInt(this.nuevoCantidad);

    if (!id || qty <= 0) return;

    const cached = this.productoCache(id);

    const nuevo: EditDetalle = {
      _key: this.genKey(),
      idDetalle: 0,
      idProducto: id,
      nombreProducto: cached ? String((cached as any).nombre ?? '(sin nombre)') : '(cargando…)',
      precioUnit: cached ? Number((cached as any).precioVenta ?? (cached as any).precio ?? 0) : (NaN as any),
      cantidad: qty,
      _add: true,
      productoNuevoId: id
    };

    this._detalles.set([...this._detalles(), nuevo]);

    // si no estaba en caché, lo buscamos
    if (!cached) {
      this.productoSrv.buscarPorId(id).subscribe({
        next: (prod: any) => {
          nuevo.nombreProducto = prod?.nombre ?? '(sin nombre)';
          nuevo.precioUnit = Number(prod?.precioVenta ?? prod?.precio ?? 0);
          this._detalles.set([...this._detalles()]);
        },
        error: () => {
          nuevo.nombreProducto = '(producto no encontrado)';
          nuevo.precioUnit = NaN as any;
          this._detalles.set([...this._detalles()]);
        }
      });
    }

    // limpiar inputs
    this.nuevoProductoId = null;
    this.nuevoCantidad = 1;
    this.proposeIfEmpty();
  }

  ajustarPagosAlTotal() {
    const total = this.totalCalculadoVista();
    this.efectivo.set(total);
    this.tarjeta.set(0);
    this.transferencia.set(0);
  }

  /* -------------------------------- Guardar (PATCH) -------------------------------- */

  guardar() {
    if (!this.data?.idVenta) return;

    // 1) Si no quedan detalles vivos ⇒ ANULAR
    const vivos = this._detalles().filter(d => !d._deleted).length;
    if (vivos === 0) {
      this.guardando = true;
      this.srv.patch(this.data.idVenta, { acciones: [{ op: 'ANULAR' }] }).subscribe({
        next: (ventaActualizada) => {
          this.guardando = false;
          this.guardado.emit(ventaActualizada);
        },
        error: (err) => {
          this.guardando = false;
          this.error = err?.error?.detail || 'No se pudo anular.';
        }
      });
      return;
    }

    // 2) Validaciones previas
    if (this.unknownPrice()) {
      this.error = 'Hay productos sin precio válido. No se puede guardar.';
      return;
    }

    // 3) Congelar totales/pagos para armar el PATCH
    const totalVista = this.round2(this.totalCalculadoVista());
    let ef = this.round2(this.efectivo());
    let tj = this.round2(this.tarjeta());
    let tr = this.round2(this.transferencia());
    let suma = this.round2(ef + tj + tr);

    // Ajuste fino: si no coincide exactamente con total, ajustar efectivo
    if (Math.abs(suma - totalVista) > 0.009) {
      const diff = this.round2(totalVista - suma);
      ef = this.round2(ef + diff);
      suma = this.round2(ef + tj + tr);
    }

    // 4) Construir acciones de DETALLES
    const acciones: any[] = [];

    // existentes
    for (const d of this._detalles()) {
      if (d.idDetalle > 0) {
        if (d._deleted) {
          acciones.push({ op: 'ELIMINAR_DETALLE', idDetalle: Number(d.idDetalle) });
          continue;
        }
        if (d.productoNuevoId && d.productoNuevoId !== d.idProducto) {
          acciones.push({
            op: 'REEMPLAZAR_PRODUCTO',
            idDetalle: Number(d.idDetalle),
            idProductoNuevo: Number(d.productoNuevoId),
            cantidad: Math.trunc(Math.max(1, Number(d.cantidad || 1)))
          });
          continue;
        }
        if (d._changedCantidad) {
          acciones.push({
            op: 'CAMBIAR_CANTIDAD',
            idDetalle: Number(d.idDetalle),
            nuevaCantidad: Math.trunc(Math.max(1, Number(d.cantidad || 1)))
          });
        }
      }
    }

    // nuevos
    for (const d of this._detalles()) {
      if (d.idDetalle === 0 && d._add && !d._deleted) {
        const idProd = d.productoNuevoId ?? d.idProducto;
        acciones.push({
          op: 'AGREGAR_DETALLE',
          idProducto: Number(idProd),
          cantidad: Math.trunc(Math.max(1, Number(d.cantidad || 1)))
        });
      }
    }

    // 5) Acción de PAGOS
    const pagos: PagoData[] = [];
    if (ef > 0) pagos.push({ tipoPago: 'EFECTIVO' as any, monto: ef });
    if (tj > 0) pagos.push({ tipoPago: 'TARJETA' as any, monto: tj });
    if (tr > 0) pagos.push({ tipoPago: 'TRANSFERENCIA' as any, monto: tr });
    acciones.push({ op: 'REEMPLAZAR_PAGOS', pagos });

    // 6) PATCH
    this.guardando = true;
    this.srv.patch(this.data.idVenta, { acciones }).subscribe({
      next: (ventaActualizada) => {
        this.guardando = false;
        this.guardado.emit(ventaActualizada);
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.detail || 'No se pudo guardar.';
      }
    });
  }
}

/* ------------------------------ Helpers locales ------------------------------ */

function cryptoRandomKey(): string {
  try {
    return Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-');
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}
