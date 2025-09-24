// src/app/pages/punto-venta/punto-venta.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  finalize,
} from 'rxjs';

import { CategoriaService } from '../../services/categoria-service';
import { ProductoService } from '../../services/producto-service';
import { VentaService } from '../../services/venta-service';
import { GimnasioService } from '../../services/gimnasio-service';
import { TicketService, VentaContexto } from '../../services/ticket-service';
import { JwtHelperService } from '@auth0/angular-jwt';

import { CategoriaData } from '../../model/categoria-data';
import { ProductoData } from '../../model/producto-data';
import { ResumenVenta } from '../resumen-venta/resumen-venta';
import { TipoPago } from '../../util/enums/tipo-pago';
import { NotificacionService } from '../../services/notificacion-service';
import { VentaCreateRequest } from '../../model/venta-create';
import { GimnasioData } from '../../model/gimnasio-data';
import { environment } from '../../../environments/environment';
import { CarritoItem, CarritoService } from '../../services/carrito-service';
import { crearContextoTicket } from '../../util/ticket-contexto';

// NUEVO: servicio y tipo del carrito

@Component({
  selector: 'app-punto-venta',
  standalone: true,
  imports: [CommonModule, FormsModule, ResumenVenta],
  templateUrl: './punto-venta.html',
  styleUrl: './punto-venta.css',
})
export class PuntoVenta implements OnInit {
  // Servicios
  private categoriaSrv = inject(CategoriaService);
  private productoSrv = inject(ProductoService);
  private ventaSrv = inject(VentaService);
  private gimnasioSrv = inject(GimnasioService);
  private notificacion = inject(NotificacionService);
  private ticket = inject(TicketService);
  private jwt = inject(JwtHelperService);

  // NUEVO: carrito
  private carritoSrv = inject(CarritoService);

  // Estado de autenticación/tenant
  gym: GimnasioData | null = null;
  cajero = 'Cajero';

  // UI principal
  modo: 'categorias' | 'productos' = 'categorias';

  // Categorías
  categorias: CategoriaData[] = [];
  paginaCategorias = 0;
  tamanoPaginaCategorias = 6;
  categoriaActivaId: number | null = null;
  categoriaHoverId: number | null = null;

  get totalPagCats(): number {
    return Math.max(
      1,
      Math.ceil(this.categorias.length / this.tamanoPaginaCategorias)
    );
  }
  get categoriasVisibles(): CategoriaData[] {
    const ini = this.paginaCategorias * this.tamanoPaginaCategorias;
    return this.categorias.slice(ini, ini + this.tamanoPaginaCategorias);
  }

  // Productos
  productos: ProductoData[] = [];
  productosFiltrados: ProductoData[] = [];
  productoSeleccionado: ProductoData | null = null;

  // Búsqueda
  terminoBusqueda = '';
  private search$ = new Subject<string>();

  // Carrito (migrado a servicio) — solo queda el control de cantidad
  cantidadParaAgregar = 1;

  // Modal
  mostrarModalResumen = false;
  realizandoPago = false;
  readonly fechaHoy = new Date();
  readonly tipoPagoInicial: TipoPago = 'EFECTIVO';
  usuarioId = 1;

  // Estado general
  cargandoCategorias = true;
  cargandoProductos = false;
  error: string | null = null;

  ngOnInit(): void {
    this.cargarContextoDesdeToken();
    this.cargarCategorias();

    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          const t = (q ?? '').trim();
          if (t.length >= 2) {
            this.modo = 'productos';
            this.categoriaActivaId = null;
            this.cargandoProductos = true;
            this.productoSeleccionado = null;
            return this.productoSrv
              .buscarPorNombre(t)
              .pipe(finalize(() => (this.cargandoProductos = false)));
          }
          if (t.length === 0) {
            if (this.categoriaActivaId == null) {
              this.modo = 'categorias';
              this.productos = [];
              this.productosFiltrados = [];
              this.productoSeleccionado = null;
            } else {
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
        error: () => {
          this.error = 'No se pudo ejecutar la búsqueda.';
          this.cargandoProductos = false;
        },
      });
  }

  // === Contexto (gimnasio/cajero) ===
  private cargarContextoDesdeToken(): void {
    const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!token) return;

    try {
      const decoded: any = this.jwt.decodeToken(token);
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;

      const idGym =
        decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gimnasioSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => {
            this.gym = g;
          },
          error: () => {
            this.gym = null;
          },
        });
      }
    } catch {
      // token inválido → fallback
    }
  }

  // === Categorías / Productos ===
  private cargarCategorias(): void {
    this.cargandoCategorias = true;
    this.error = null;

    this.categoriaSrv.buscarTodos().subscribe({
      next: (lista) => {
        this.categorias = lista ?? [];
        this.cargandoCategorias = false;
        this.modo = 'categorias';
      },
      error: () => {
        this.cargandoCategorias = false;
        this.error = 'No se pudieron cargar las categorías.';
      },
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
      error: () => {
        this.cargandoProductos = false;
        this.error = 'No se pudieron cargar los productos.';
      },
    });
  }

  onBuscarChange(valor: string): void {
    this.terminoBusqueda = valor;
    this.search$.next(valor);
  }

  seleccionarProducto(p: ProductoData): void {
    if (this.toNumber(p.cantidad) <= 0) return;
    this.productoSeleccionado = p;
  }

  // === Stock helpers ===
  stockOriginal(p: ProductoData): number {
    return this.toNumber(p.cantidad);
  }

  private stockYaEnCarrito(idProd: number): number {
    return this.carritoSrv.cantidadEnCarrito(idProd);
  }

  stockDisponible(p: ProductoData): number {
    const id = Number((p.idProducto as unknown) ?? 0);
    return Math.max(0, this.stockOriginal(p) - this.stockYaEnCarrito(id));
  }

  // === Carrito (vía servicio) ===
  get carrito(): CarritoItem[] {
    return this.carritoSrv.obtenerItems();
  }
  get indiceCarritoSeleccionado(): number | null {
    return this.carritoSrv.obtenerIndiceSeleccionado();
  }
  get total(): number {
    return this.carritoSrv.obtenerTotal();
  }

  agregarAlCarrito(): void {
    const p = this.productoSeleccionado;
    if (!p || this.cantidadParaAgregar <= 0) return;

    const disponible = this.stockDisponible(p);
    if (this.cantidadParaAgregar > disponible) {
      this.notificacion.aviso(
        `Solo hay ${disponible} en stock para "${String(p.nombre ?? '')}".`
      );
      return;
    }

    const id = Number((p.idProducto as unknown) ?? 0);
    const precio = this.toNumber(p.precioVenta);
    this.carritoSrv.agregar(
      id,
      String(p.nombre ?? ''),
      precio,
      this.cantidadParaAgregar
    );
    this.cantidadParaAgregar = 1;
  }

  seleccionarLineaCarrito(idx: number): void {
    this.carritoSrv.seleccionarIndice(idx);
  }
  sumar(): void {
    this.carritoSrv.sumarSeleccionado();
  }
  restar(): void {
    this.carritoSrv.restarSeleccionado();
  }
  eliminarSeleccionado(): void {
    this.carritoSrv.eliminarSeleccionado();
  }

  cancelar(): void {
    this.carritoSrv.limpiar();
    this.productoSeleccionado = null;
    this.cantidadParaAgregar = 1;
    if (!this.categoriaActivaId && this.terminoBusqueda.length < 2)
      this.modo = 'categorias';
  }

  // === Modal Resumen / Pago ===
  abrirModalResumen(): void {
    if (this.carrito.length === 0) {
      this.notificacion.aviso('Tu carrito está vacío.');
      return;
    }
    this.mostrarModalResumen = true;
  }
  cerrarModalResumen(): void {
    this.mostrarModalResumen = false;
  }

  confirmarVentaDesdeModal(tipoPago: TipoPago): void {
  if (this.realizandoPago) return;
  if (this.carrito.length === 0) { this.notificacion.aviso('Tu carrito está vacío.'); return; }

  const payload: VentaCreateRequest = {
    tipoPago,
    detalles: this.carrito.map((it: CarritoItem) => ({ idProducto: it.idProducto, cantidad: it.cantidad }))
  };

  this.realizandoPago = true;

  this.ventaSrv.crearVenta(payload).subscribe({
    next: (resp: unknown) => {
      this.realizandoPago = false;
      this.cerrarModalResumen();
      this.notificacion.exito('¡Venta registrada correctamente!');

      const venta: any = Array.isArray(resp) ? resp[0] : resp;
      const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);

      if (venta?.detalles?.length) {
        this.ticket.verVentaDesdeBackend(venta, ctx, String(tipoPago));
      } else {
        this.ticket.verVentaDesdeCarrito(this.carrito, ctx, String(tipoPago), venta?.idVenta, new Date());
      }

      this.cancelar();
      this.volverACategorias();
    },
    error: () => {
      this.realizandoPago = false;
      this.notificacion.error('No se pudo registrar la venta.');
    }
  });
}


  // Helpers numéricos
  toNumber(v: unknown): number {
    return typeof v === 'number' ? v : Number((v as unknown) ?? 0);
  }

}
