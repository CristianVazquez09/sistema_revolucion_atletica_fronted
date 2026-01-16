import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { ProductoModal } from './producto-modal/producto-modal';
import { ProductoService } from '../../services/producto-service';
import { ProductoData } from '../../model/producto-data';
import { NotificacionService } from '../../services/notificacion-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import { MenuService } from 'src/app/services/menu-service';

import { StockModal, StockModalModo } from './stock-modal/stock-modal';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductoModal, StockModal, RouterLink],
  templateUrl: './producto.html',
  styleUrl: './producto.css',
})
export class Producto implements OnInit {
  private productoSrv = inject(ProductoService);
  private router = inject(Router);
  private notificacion = inject(NotificacionService);
  private jwt = inject(JwtHelperService);
  private menuSrv = inject(MenuService);

  menuAbierto = this.menuSrv.menuAbierto;

  isAdmin = false;
  isGerente = false;
  puedeMoverStock = false;

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

  ngOnInit(): void {
    const roles = this.leerRolesDesdeToken();
    this.isAdmin = roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    this.isGerente = roles.includes('GERENTE') || roles.includes('ROLE_GERENTE');

    this.puedeMoverStock = this.isAdmin || this.isGerente;

    this.cargar();
  }

  private leerRolesDesdeToken(): string[] {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return [];
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
        ...(Array.isArray(decoded?.realm_access?.roles)
          ? decoded.realm_access.roles
          : []),
      ]
        .concat([decoded?.role, decoded?.rol, decoded?.perfil].filter(Boolean) as string[])
        .map((r) => String(r).toUpperCase());
      if (decoded?.is_admin === true && !roles.includes('ADMIN')) roles.push('ADMIN');
      return roles;
    } catch {
      return [];
    }
  }

  // helpers de gimnasio compat (id | idGimnasio)
  getGymId(obj: any): number | null {
    if (!obj) return null;
    const id = obj.id ?? obj.idGimnasio ?? null;
    return id != null ? Number(id) : null;
  }
  gymLabel(obj: any): string {
    const id = this.getGymId(obj);
    return obj?.nombre ?? (id != null ? `#${id}` : '—');
  }

  cargar(): void {
    this.loading = true;
    this.error = null;

    this.productoSrv.buscarTodos().subscribe({
      next: (data) => {
        this.productos = (data ?? []).filter((p) => p?.activo !== false) as any[];
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'No se pudieron cargar los productos.';
        this.loading = false;
      },
    });
  }

  abrirCrear(): void {
    this.productoEditando = null;
    this.mostrarModal.set(true);
  }

  editar(p: ProductoData & { gimnasio?: any }): void {
    this.productoEditando = p;
    this.mostrarModal.set(true);
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
  }

  onGuardado(): void {
    this.cerrarModal();
    this.cargar();
  }

  desactivar(p: ProductoData & { gimnasio?: any }): void {
    if (!p?.idProducto) return;
    if (!confirm(`¿Desactivar producto "${p.nombre}"?`)) return;

    const actualizado: ProductoData & { gimnasio?: any } = {
      ...p,
      activo: false,
    };

    this.productoSrv.actualizar(p.idProducto, actualizado).subscribe({
      next: () => {
        this.notificacion.exito('Producto desactivado.');
        this.cargar();
      },
      error: () =>
        this.notificacion.error('No se pudo desactivar el producto.'),
    });
  }

  // ✅ Stock
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
    this.cargar();
  }
}
