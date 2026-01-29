import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  filter,
  switchMap,
  tap,
  skip,
} from 'rxjs';

import { ProductoModal } from './producto-modal/producto-modal';
import { ProductoService } from '../../services/producto-service';
import { ProductoData } from '../../model/producto-data';
import { NotificacionService } from '../../services/notificacion-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import { MenuService } from 'src/app/services/menu-service';

import { StockModal, StockModalModo } from './stock-modal/stock-modal';

// ✅ tenant / filtro gimnasio (admin)
import { TenantContextService } from 'src/app/core/tenant-context.service';
import { RaGimnasioFilterComponent } from 'src/app/shared/ra-app-zoom/ra-gimnasio-filter/ra-gimnasio-filter';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ProductoModal,
    StockModal,
    RouterLink,
    RaGimnasioFilterComponent, // ✅
  ],
  templateUrl: './producto.html',
  styleUrl: './producto.css',
})
export class Producto implements OnInit, OnDestroy {
  private productoSrv = inject(ProductoService);
  private router = inject(Router);
  private notificacion = inject(NotificacionService);
  private jwt = inject(JwtHelperService);
  private menuSrv = inject(MenuService);

  // ✅ tenant ctx
  private tenantCtx = inject(TenantContextService);
  private destroyRef = inject(DestroyRef);

  menuAbierto = this.menuSrv.menuAbierto;

  isAdmin = false;
  isGerente = false;

  // permisos
  puedeMoverStock = false;
  puedeCrudProducto = false;

  productos: (ProductoData & { gimnasio?: any })[] = [];
  loading = true;
  error: string | null = null;

  // Modal CRUD producto
  mostrarModal = signal(false);
  productoEditando: (ProductoData & { gimnasio?: any }) | null = null;

  // Modal stock
  mostrarStockModal = signal(false);
  stockProducto: (ProductoData & { gimnasio?: any }) | null = null;
  stockModo: StockModalModo = 'ENTRADA';

  // ✅ buscador con debounce (>=3)
  terminoBusqueda = '';
  private readonly minCaracteresBusqueda = 3;
  private busqueda$ = new Subject<string>();
  private subsBusqueda?: Subscription;

  ngOnInit(): void {
    // ✅ init tenant context (admin / view tenant)
    this.tenantCtx.initFromToken();

    // roles
    const roles = this.leerRolesDesdeToken();
    const adminPorRol = roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    const gerentePorRol = roles.includes('GERENTE') || roles.includes('ROLE_GERENTE');

    this.isAdmin = this.tenantCtx.isAdmin || adminPorRol;
    this.isGerente = gerentePorRol;

    // ✅ ambos (admin/gerente) pueden mover stock y CRUD en UI
    this.puedeMoverStock = this.isAdmin || this.isGerente;
    this.puedeCrudProducto = this.isAdmin || this.isGerente;

    // ✅ Admin: al cambiar gimnasio en selector => recarga lista (respetando búsqueda si aplica)
    if (this.isAdmin) {
      this.tenantCtx.viewTenantChanges$
        .pipe(
          distinctUntilChanged(),
          skip(1),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => this.refrescarListado());
    }

    // primera carga
    this.cargarListadoBase();

    // ✅ búsqueda con debounce
    this.subsBusqueda = this.busqueda$
      .pipe(
        map((v) => this.normalizarTermino(v)),
        debounceTime(350),
        distinctUntilChanged(),
        tap((txt) => {
          if (txt.length === 0) this.cargarListadoBase(); // limpiar => base
        }),
        filter((txt) => txt.length >= this.minCaracteresBusqueda),
        switchMap((txt) => {
          this.loading = true;
          this.error = null;
          return this.productoSrv
            .buscarPorNombre(txt) // ✅ TU SERVICE
            .pipe(finalize(() => (this.loading = false)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          this.productos = (data ?? []).filter((p) => p?.activo !== false) as any[];
        },
        error: (err) => {
          console.error(err);
          this.error = 'No se pudo ejecutar la búsqueda de productos.';
        },
      });
  }

  ngOnDestroy(): void {
    this.subsBusqueda?.unsubscribe();

    // ✅ si admin eligió un gimnasio aquí, al salir lo regresamos a "Todos"
    if (this.isAdmin) {
      this.tenantCtx.setViewTenant(null);
    }
  }

  // =========================
  // Helpers
  // =========================
  private normalizarTermino(v: string): string {
    return (v ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private leerRolesDesdeToken(): string[] {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return [];
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
        ...(Array.isArray(decoded?.realm_access?.roles) ? decoded.realm_access.roles : []),
      ]
        .concat([decoded?.role, decoded?.rol, decoded?.perfil].filter(Boolean) as string[])
        .map((r) => String(r).toUpperCase());

      if (decoded?.is_admin === true && !roles.includes('ADMIN')) roles.push('ADMIN');
      return roles;
    } catch {
      return [];
    }
  }

  getGymId(obj: any): number | null {
    if (!obj) return null;
    const id = obj.id ?? obj.idGimnasio ?? null;
    return id != null ? Number(id) : null;
  }

  gymLabel(obj: any): string {
    const id = this.getGymId(obj);
    return obj?.nombre ?? (id != null ? `#${id}` : '—');
  }

  // =========================
  // Carga / búsqueda
  // =========================
  private cargarListadoBase(): void {
    this.loading = true;
    this.error = null;

    this.productoSrv
      .buscarTodos()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data) => {
          this.productos = (data ?? []).filter((p) => p?.activo !== false) as any[];
        },
        error: (err) => {
          console.error(err);
          this.error = 'No se pudieron cargar los productos.';
        },
      });
  }

  private refrescarListado(): void {
    const txt = this.normalizarTermino(this.terminoBusqueda);
    if (txt.length >= this.minCaracteresBusqueda) {
      this.loading = true;
      this.error = null;

      this.productoSrv
        .buscarPorNombre(txt)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: (data) => {
            this.productos = (data ?? []).filter((p) => p?.activo !== false) as any[];
          },
          error: (err) => {
            console.error(err);
            this.error = 'No se pudo ejecutar la búsqueda de productos.';
          },
        });
    } else {
      this.cargarListadoBase();
    }
  }

  // =========================
  // Buscador UI
  // =========================
  onBuscarChange(valor: string): void {
    const limpio = this.normalizarTermino(valor);
    this.terminoBusqueda = limpio;

    // si aún no llega a 3, no buscar (pero si está vacío se recarga por el tap)
    if (limpio.length > 0 && limpio.length < this.minCaracteresBusqueda) return;

    this.busqueda$.next(limpio);
  }

  limpiarBusqueda(): void {
    this.onBuscarChange('');
  }

  // =========================
  // CRUD Producto
  // =========================
  abrirCrear(): void {
    if (!this.puedeCrudProducto) return;
    this.productoEditando = null;
    this.mostrarModal.set(true);
  }

  editar(p: ProductoData & { gimnasio?: any }): void {
    if (!this.puedeCrudProducto) return;
    this.productoEditando = p;
    this.mostrarModal.set(true);
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
  }

  onGuardado(): void {
    this.cerrarModal();
    this.refrescarListado();
  }

  desactivar(p: ProductoData & { gimnasio?: any }): void {
    if (!this.puedeCrudProducto) return;
    if (!p?.idProducto) return;
    if (!confirm(`¿Desactivar producto "${p.nombre}"?`)) return;

    const actualizado: ProductoData & { gimnasio?: any } = { ...p, activo: false };

    this.productoSrv.actualizar(p.idProducto, actualizado).subscribe({
      next: () => {
        this.notificacion.exito('Producto desactivado.');
        this.refrescarListado();
      },
      error: () => this.notificacion.error('No se pudo desactivar el producto.'),
    });
  }

  // =========================
  // Stock
  // =========================
  abrirEntrada(p: ProductoData & { gimnasio?: any }): void {
    if (!this.puedeMoverStock) return;
    this.stockProducto = p;
    this.stockModo = 'ENTRADA';
    this.mostrarStockModal.set(true);
  }

  abrirAjuste(p: ProductoData & { gimnasio?: any }): void {
    if (!this.puedeMoverStock) return;
    this.stockProducto = p;
    this.stockModo = 'AJUSTE';
    this.mostrarStockModal.set(true);
  }

  cerrarStockModal(): void {
    this.mostrarStockModal.set(false);
    this.stockProducto = null;
  }

  onStockAplicado(): void {
    this.cerrarStockModal();
    this.refrescarListado();
  }
}
