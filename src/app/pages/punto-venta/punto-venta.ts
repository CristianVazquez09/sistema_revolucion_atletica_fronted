import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, finalize } from 'rxjs';

import { CategoriaService } from '../../services/categoria-service';
import { ProductoService } from '../../services/producto-service';
import { VentaService } from '../../services/venta-service';

import { CategoriaData } from '../../model/categoria-data';
import { ProductoData } from '../../model/producto-data';
// Modal de resumen
import { ResumenVenta } from '../resumen-venta/resumen-venta';
import { TipoPago } from '../../util/enums/tipo-pago';
import { NotificacionService } from '../../services/notificacion-service';

type CarritoItem = {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnit: number;
};

@Component({
  selector: 'app-punto-venta',
  standalone: true,
  imports: [CommonModule, FormsModule, ResumenVenta],
  templateUrl: './punto-venta.html',
  styleUrl: './punto-venta.css'
})
export class PuntoVenta implements OnInit {
  // Inyección de servicios
  private categoriaSrv = inject(CategoriaService);
  private productoSrv  = inject(ProductoService);
  private ventaSrv     = inject(VentaService);
  private notificacion = inject(NotificacionService);

  // UI principal (categorías o productos)
  modo: 'categorias' | 'productos' = 'categorias';

  // ───────────── Categorías ─────────────
  categorias: CategoriaData[] = [];
  paginaCategorias = 0;
  tamanoPaginaCategorias = 6; // 3x2
  categoriaActivaId: number | null = null;
  categoriaHoverId: number | null = null;

  get totalPagCats(): number {
    return Math.max(1, Math.ceil(this.categorias.length / this.tamanoPaginaCategorias));
  }
  get categoriasVisibles(): CategoriaData[] {
    const ini = this.paginaCategorias * this.tamanoPaginaCategorias;
    return this.categorias.slice(ini, ini + this.tamanoPaginaCategorias);
  }

  // ───────────── Productos ─────────────
  productos: ProductoData[] = [];
  productosFiltrados: ProductoData[] = [];
  productoSeleccionado: ProductoData | null = null;

  // Búsqueda (backend en ≥ 2 letras)
  terminoBusqueda = '';
  private search$ = new Subject<string>();

  // ───────────── Carrito ─────────────
  carrito: CarritoItem[] = [];
  indiceCarritoSeleccionado: number | null = null;
  cantidadParaAgregar = 1;

  // ───────────── Pago / Modal ─────────────
  mostrarModalResumen = false;
  realizandoPago = false;
  readonly fechaHoy = new Date();
  readonly tipoPagoInicial: TipoPago = 'EFECTIVO';
  usuarioId = 1; // reemplaza cuando tengas auth

  // ───────────── Estado general ─────────────
  cargandoCategorias = true;
  cargandoProductos = false;
  error: string | null = null;

  ngOnInit(): void {
    this.cargarCategorias();

    // Buscador con debounce y llamado al backend en ≥ 2 caracteres
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          const t = (q ?? '').trim();
          if (t.length >= 2) {
            this.modo = 'productos';
            this.categoriaActivaId = null;      // búsqueda libre
            this.cargandoProductos = true;
            this.productoSeleccionado = null;
            return this.productoSrv.buscarPorNombre(t)
              .pipe(finalize(() => (this.cargandoProductos = false)));
          }
          if (t.length === 0) {
            if (this.categoriaActivaId == null) {
              // sin término y sin categoría: volver a categorías
              this.modo = 'categorias';
              this.productos = [];
              this.productosFiltrados = [];
              this.productoSeleccionado = null;
            } else {
              // había categoría activa: recargar su lista
              this.cargarProductosPorCategoria(this.categoriaActivaId);
            }
          }
          return of(null);
        })
      )
      .subscribe({
        next: (lista: ProductoData[] | null) => {
          if (!lista) return;
          this.productos = lista ?? [];
          this.productosFiltrados = [...this.productos];
        },
        error: (err: unknown) => {
          console.error(err);
          this.error = 'No se pudo ejecutar la búsqueda.';
          this.cargandoProductos = false;
        }
      });
  }

  // ───────────── Categorías ─────────────
  private cargarCategorias(): void {
    this.cargandoCategorias = true;
    this.error = null;

    this.categoriaSrv.buscarTodos().subscribe({
      next: (lista) => {
        this.categorias = lista ?? [];
        this.cargandoCategorias = false;
        this.modo = 'categorias';
      },
      error: (err: unknown) => {
        console.error(err);
        this.cargandoCategorias = false;
        this.error = 'No se pudieron cargar las categorías.';
      }
    });
  }

  seleccionarCategoria(c: CategoriaData): void {
    if (!c?.idCategoria) return;
    this.categoriaActivaId = Number(c.idCategoria);
    this.terminoBusqueda = '';
    this.productoSeleccionado = null;
    this.cargarProductosPorCategoria(this.categoriaActivaId);
    this.modo = 'productos';
  }

  onCategoriaHover(c?: CategoriaData): void {
    this.categoriaHoverId = c?.idCategoria ?? null;
  }
  anteriorPaginaCategorias(): void {
    if (this.paginaCategorias > 0) this.paginaCategorias--;
  }
  siguientePaginaCategorias(): void {
    if (this.paginaCategorias + 1 < this.totalPagCats) this.paginaCategorias++;
  }

  volverACategorias(): void {
    this.modo = 'categorias';
    this.categoriaActivaId = null;
    this.productos = [];
    this.productosFiltrados = [];
    this.productoSeleccionado = null;
    this.terminoBusqueda = '';
  }

  // ───────────── Productos ─────────────
  private cargarProductosPorCategoria(idCategoria: number): void {
    this.cargandoProductos = true;
    this.error = null;
    this.productos = [];
    this.productosFiltrados = [];

    this.productoSrv.buscarPorCategoria(idCategoria).subscribe({
      next: (lista: ProductoData[]) => {
        this.productos = lista ?? [];
        this.productosFiltrados = [...this.productos];
        this.cargandoProductos = false;
      },
      error: (err: unknown) => {
        console.error(err);
        this.cargandoProductos = false;
        this.error = 'No se pudieron cargar los productos.';
      }
    });
  }

  onBuscarChange(valor: string): void {
    this.terminoBusqueda = valor;
    this.search$.next(valor);
  }

  seleccionarProducto(p: ProductoData): void {
    if (this.toNumber(p.cantidad) <= 0) return; // protección: sin stock
    this.productoSeleccionado = p;
  }

  // ───────────── Stock helpers ─────────────
  stockOriginal(p: ProductoData): number {
    return this.toNumber(p.cantidad);
  }
  stockYaEnCarrito(idProd: number): number {
    return this.carrito
      .filter(x => x.idProducto === idProd)
      .reduce((acc, it) => acc + it.cantidad, 0);
  }
  stockDisponible(p: ProductoData): number {
    const id = Number((p.idProducto as any) ?? 0);
    return Math.max(0, this.stockOriginal(p) - this.stockYaEnCarrito(id));
  }

  // ───────────── Carrito ─────────────
  agregarAlCarrito(): void {
    const p = this.productoSeleccionado;
    if (!p || this.cantidadParaAgregar <= 0) return;

    const disponible = this.stockDisponible(p);
    if (this.cantidadParaAgregar > disponible) {
      this.notificacion.aviso(`Solo hay ${disponible} en stock para "${String(p.nombre ?? '')}".`);
      return;
    }

    const id = Number((p.idProducto as any) ?? 0);
    const ya = this.carrito.findIndex((x) => x.idProducto === id);
    const precio = this.toNumber(p.precioVenta);

    if (ya >= 0) {
      this.carrito[ya].cantidad += this.cantidadParaAgregar;
      this.indiceCarritoSeleccionado = ya;
    } else {
      this.carrito.push({
        idProducto: id,
        nombre: String(p.nombre ?? ''),
        cantidad: this.cantidadParaAgregar,
        precioUnit: precio
      });
      this.indiceCarritoSeleccionado = this.carrito.length - 1;
    }
    this.cantidadParaAgregar = 1;
  }

  seleccionarLineaCarrito(idx: number): void {
    this.indiceCarritoSeleccionado = idx;
  }

  sumar(): void {
    if (this.indiceCarritoSeleccionado == null) return;
    const item = this.carrito[this.indiceCarritoSeleccionado];

    // respetar stock
    const prod = this.productos.find(p => Number(p.idProducto as any ?? 0) === item.idProducto);
    const stockTotal = prod ? this.stockOriginal(prod) : Infinity;
    const enCarrito = this.stockYaEnCarrito(item.idProducto);

    if (enCarrito < stockTotal) item.cantidad++;
    else this.notificacion.aviso('No hay más stock disponible.');
  }

  restar(): void {
    if (this.indiceCarritoSeleccionado == null) return;
    const item = this.carrito[this.indiceCarritoSeleccionado];
    item.cantidad = Math.max(1, item.cantidad - 1);
  }

  eliminarSeleccionado(): void {
    if (this.indiceCarritoSeleccionado == null) return;
    this.carrito.splice(this.indiceCarritoSeleccionado, 1);
    this.indiceCarritoSeleccionado = null;
  }

  get total(): number {
    return this.carrito.reduce((acc, it) => acc + it.cantidad * it.precioUnit, 0);
  }

  cancelar(): void {
    this.carrito = [];
    this.indiceCarritoSeleccionado = null;
    this.productoSeleccionado = null;
    this.cantidadParaAgregar = 1;
    if (!this.categoriaActivaId && this.terminoBusqueda.length < 2) this.modo = 'categorias';
  }

  // ───────────── Modal Resumen / Pago ─────────────
  abrirModalResumen(): void {
    if (this.carrito.length === 0) { this.notificacion.aviso('Tu carrito está vacío.'); return; }
    this.mostrarModalResumen = true;
  }
  cerrarModalResumen(): void {
    this.mostrarModalResumen = false;
  }

  confirmarVentaDesdeModal(tipoPago: TipoPago): void {
    if (this.realizandoPago) return;

    const detalles = this.carrito.map(it => ({
      producto: { idProducto: it.idProducto },
      cantidad: it.cantidad,
      subTotal: this.round2(it.cantidad * it.precioUnit)
    }));

    const body = {
      total: this.round2(this.total),
      tipoPago,
      detalles,
      usuario: { idUsuario: this.usuarioId }
    };

    this.realizandoPago = true;
    this.ventaSrv.guardar(body as any).subscribe({
      next: () => {
        this.realizandoPago = false;
        this.cerrarModalResumen();
        this.cancelar();
        this.volverACategorias();
        this.notificacion.exito('¡Venta registrada correctamente!');
      },
      error: (err: unknown) => {
        console.error(err);
        this.realizandoPago = false;
        this.notificacion.error('No se pudo registrar la venta.');
      }
    });
  }

  // Helpers numéricos
  toNumber(v: unknown): number {
    return typeof v === 'number' ? v : Number((v as any) ?? 0);
  }
  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
