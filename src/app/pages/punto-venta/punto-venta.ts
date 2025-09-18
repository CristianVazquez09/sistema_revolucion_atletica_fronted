// src/app/pages/punto-venta/punto-venta.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, finalize } from 'rxjs';

import { CategoriaService } from '../../services/categoria-service';
import { ProductoService } from '../../services/producto-service';
import { VentaService } from '../../services/venta-service';
import { GimnasioService } from '../../services/gimnasio-service'; // 👈
import { TicketService } from '../../services/ticket-service';     // 👈
import { JwtHelperService } from '@auth0/angular-jwt';             // 👈

import { CategoriaData } from '../../model/categoria-data';
import { ProductoData } from '../../model/producto-data';
import { ResumenVenta } from '../resumen-venta/resumen-venta';
import { TipoPago } from '../../util/enums/tipo-pago';
import { NotificacionService } from '../../services/notificacion-service';
import { VentaCreateRequest } from '../../model/venta-create';
import { GimnasioData } from '../../model/gimnasio-data';
import { environment } from '../../../environments/environment';

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
  // Servicios
  private categoriaSrv = inject(CategoriaService);
  private productoSrv  = inject(ProductoService);
  private ventaSrv     = inject(VentaService);
  private gimnasioSrv  = inject(GimnasioService);  // 👈
  private notificacion = inject(NotificacionService);
  private ticket       = inject(TicketService);    // 👈
  private jwt          = inject(JwtHelperService); // 👈

  // Estado de autenticación/tenant
  gym: GimnasioData | null = null;    // 👈 datos para el ticket
  cajero = 'Cajero';                  // 👈 nombre del usuario autenticado

  // UI principal
  modo: 'categorias' | 'productos' = 'categorias';

  // Categorías
  categorias: CategoriaData[] = [];
  paginaCategorias = 0;
  tamanoPaginaCategorias = 6;
  categoriaActivaId: number | null = null;
  categoriaHoverId: number | null = null;

  get totalPagCats(): number {
    return Math.max(1, Math.ceil(this.categorias.length / this.tamanoPaginaCategorias));
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

  // Carrito
  carrito: CarritoItem[] = [];
  indiceCarritoSeleccionado: number | null = null;
  cantidadParaAgregar = 1;

  // Pago / Modal
  mostrarModalResumen = false;
  realizandoPago = false;
  readonly fechaHoy = new Date();
  readonly tipoPagoInicial: TipoPago = 'EFECTIVO';
  usuarioId = 1; // si luego usas id real del usuario, cámbialo

  // Estado general
  cargandoCategorias = true;
  cargandoProductos = false;
  error: string | null = null;

  ngOnInit(): void {
    // 1) Decodifica token y carga cajero + gimnasio
    this.cargarContextoDesdeToken();

    // 2) Carga categorías
    this.cargarCategorias();

    // 3) Búsqueda por nombre
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          const t = (q ?? '').trim();
          if (t.length >= 2) {
            this.modo = 'productos';
            this.categoriaActivaId = null;
            this.cargandoProductos = true;
            this.productoSeleccionado = null;
            return this.productoSrv.buscarPorNombre(t)
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
        }
      });
  }

  // === Contexto (gimnasio/cajero) ===================================
  private cargarContextoDesdeToken(): void {
    const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!token) return;

    try {
      const decoded: any = this.jwt.decodeToken(token);

      // Cajero (username del token)
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;

      // id_gimnasio del token (o tenantId si así lo usas)
      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gimnasioSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => { this.gym = g; 
          
          },
          error: () => {
            // Si falla, no rompe el flujo: el ticket usará fallback.
            this.gym = null;
          }
        });
      }
    } catch {
      // token inválido → seguimos con fallback
    }
  }

  // === Categorías / Productos =======================================
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
      }
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

  // === Stock helpers =================================================
  stockOriginal(p: ProductoData): number { return this.toNumber(p.cantidad); }
  stockYaEnCarrito(idProd: number): number {
    return this.carrito.filter(x => x.idProducto === idProd).reduce((acc, it) => acc + it.cantidad, 0);
  }
  stockDisponible(p: ProductoData): number {
    const id = Number((p.idProducto as any) ?? 0);
    return Math.max(0, this.stockOriginal(p) - this.stockYaEnCarrito(id));
  }

  // === Carrito =======================================================
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
      this.carrito.push({ idProducto: id, nombre: String(p.nombre ?? ''), cantidad: this.cantidadParaAgregar, precioUnit: precio });
      this.indiceCarritoSeleccionado = this.carrito.length - 1;
    }
    this.cantidadParaAgregar = 1;
  }

  seleccionarLineaCarrito(idx: number): void { this.indiceCarritoSeleccionado = idx; }
  sumar(): void {
    if (this.indiceCarritoSeleccionado == null) return;
    const item = this.carrito[this.indiceCarritoSeleccionado];
    const prod = this.productos.find(p => Number(p.idProducto as any ?? 0) === item.idProducto);
    const stockTotal = prod ? this.stockOriginal(prod) : Infinity;
    const enCarrito = this.stockYaEnCarrito(item.idProducto);
    if (enCarrito < stockTotal) item.cantidad++; else this.notificacion.aviso('No hay más stock disponible.');
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
  get total(): number { return this.carrito.reduce((acc, it) => acc + it.cantidad * it.precioUnit, 0); }

  cancelar(): void {
    this.carrito = [];
    this.indiceCarritoSeleccionado = null;
    this.productoSeleccionado = null;
    this.cantidadParaAgregar = 1;
    if (!this.categoriaActivaId && this.terminoBusqueda.length < 2) this.modo = 'categorias';
  }

  // === Modal Resumen / Pago =========================================
  abrirModalResumen(): void {
    if (this.carrito.length === 0) { this.notificacion.aviso('Tu carrito está vacío.'); return; }
    this.mostrarModalResumen = true;
  }
  cerrarModalResumen(): void { this.mostrarModalResumen = false; }

  confirmarVentaDesdeModal(tipoPago: TipoPago): void {
  if (this.realizandoPago) return;
  if (this.carrito.length === 0) { this.notificacion.aviso('Tu carrito está vacío.'); return; }

  const payload: VentaCreateRequest = {
    tipoPago,
    detalles: this.carrito.map(it => ({ idProducto: it.idProducto, cantidad: it.cantidad }))
  };

  this.realizandoPago = true;

  this.ventaSrv.crearVenta(payload).subscribe({
    next: (resp: any) => {
      this.realizandoPago = false;
      this.cerrarModalResumen();
      this.notificacion.exito('¡Venta registrada correctamente!');

      // Normaliza la respuesta
      const venta = Array.isArray(resp) ? resp[0] : resp;

      // Negocio desde el gimnasio (o fallback)
      const negocio = {
        nombre: this.gym?.nombre ?? 'Tu gimnasio',
        direccion: this.gym?.direccion ?? '',
        telefono: this.gym?.telefono ?? ''
      };

      // ¿Viene con detalles del backend?
      const vieneDeBackend: boolean = !!(venta?.detalles?.length);

      // Mapeo correcto de ítems:
      // - Si viene del backend: usa producto.precioVenta; si no existe, saca unitario de subTotal/cantidad.
      // - Si viene del carrito: usa el precioUnit del carrito (¡aquí estaba el problema!).
      const items = (vieneDeBackend ? venta.detalles : this.carrito).map((d: any) => {
        if (vieneDeBackend) {
          const qty = Number(d?.cantidad ?? 0) || 0;
          const pVenta = Number(d?.producto?.precioVenta);
          const subTot = Number(d?.subTotal);
          const unit = Number.isFinite(pVenta)
            ? pVenta
            : (qty > 0 && Number.isFinite(subTot) ? subTot / qty : 0);
          return {
            nombre: d?.producto?.nombre ?? '—',
            cantidad: qty,
            precioUnit: unit
          };
        } else {
          // d es CarritoItem
          return {
            nombre: d.nombre,
            cantidad: d.cantidad,
            precioUnit: d.precioUnit
          };
        }
      });

      // Calcula subtotal real a partir de los ítems
      const subtotal = items.reduce((acc: number, it: any) => acc + (Number(it.cantidad) * Number(it.precioUnit)), 0);

      // Total: prioriza el del backend si llega; si no, usa subtotal
      const total = Number(venta?.total);
      const totalFinal = Number.isFinite(total) ? total : subtotal;

      // Muestra/descarga el ticket con tipo de pago
      this.ticket.verVentaComoHtml({
        // Encabezado fijo ya lo pone el service como "REVOLUCIÓN ATLÉTICA" (brandTitle default)
        negocio,
        folio: venta?.idVenta ?? '',
        fecha: venta?.fecha ?? new Date(),
        cajero: this.cajero,
        socio: '',                     // si tienes cliente, colócalo aquí
        items,
        totales: { subtotal, total: totalFinal },
        leyendaLateral: negocio.nombre,
        tipoPago: String(tipoPago)     // 👈 ahora sí se imprime la fila PAGO
      });

      // Limpieza del POS
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
  toNumber(v: unknown): number { return typeof v === 'number' ? v : Number((v as any) ?? 0); }
  private round2(n: number): number { return Math.round(n * 100) / 100; }
}
