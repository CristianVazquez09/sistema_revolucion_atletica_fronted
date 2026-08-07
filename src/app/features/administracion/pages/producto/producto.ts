import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { distinctUntilChanged, finalize, skip } from 'rxjs';

import { ProductoModal } from './producto-modal/producto-modal';
import { ProductoService } from '../../data/producto-service';
import { ProductoData } from '../../../../shared/models/producto-data';
import { NotificacionService } from '../../../../core/layout/notificacion-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../../environments/environment';
import { MenuService } from 'src/app/core/layout/menu-service';

import { StockModal, StockModalModo } from './stock-modal/stock-modal';

// ✅ tenant / filtro gimnasio (admin)
import { TenantContextService } from 'src/app/core/tenant/tenant-context-service';
import { RaGimnasioFilterComponent } from 'src/app/shared/ui/ra-gimnasio-filter/ra-gimnasio-filter';
import { RaDropdown } from 'src/app/shared/ui/ra-dropdown/ra-dropdown';
import { RaBuscador } from 'src/app/shared/ui/ra-buscador/ra-buscador';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ProductoModal,
    StockModal,
    RouterLink,
    RaGimnasioFilterComponent,
    RaDropdown,
    RaBuscador,
  ],
  templateUrl: './producto.html',
  styleUrl: './producto.css',
})
export class Producto implements OnInit, OnDestroy {
  private productoSrv = inject(ProductoService);
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

  // ✅ buscador (>=3 caracteres)
  terminoBusqueda = '';
  private readonly minCaracteresBusqueda = 3;

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
        .pipe(distinctUntilChanged(), skip(1), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.refrescarListado());
    }

    // primera carga
    this.cargarListadoBase();
  }

  ngOnDestroy(): void {
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
    const texto = this.normalizarTermino(valor);
    this.terminoBusqueda = texto;

    if (texto.length === 0) {
      this.cargarListadoBase();
      return;
    }

    if (texto.length < this.minCaracteresBusqueda) return;

    this.loading = true;
    this.error = null;

    this.productoSrv
      .buscarPorNombre(texto)
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
