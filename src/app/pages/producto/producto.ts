import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { ProductoModal } from './producto-modal/producto-modal';
import { ProductoService } from '../../services/producto-service';
import { ProductoData } from '../../model/producto-data';
import { NotificacionService } from '../../services/notificacion-service';

// Deducir admin
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductoModal, RouterLink],
  templateUrl: './producto.html',
  styleUrl: './producto.css',
})
export class Producto implements OnInit {
  private productoSrv = inject(ProductoService);
  private router = inject(Router);
  private notificacion = inject(NotificacionService);
  private jwt = inject(JwtHelperService);

  // Admin?
  isAdmin = false;

  productos: (ProductoData & { gimnasio?: any })[] = [];
  loading = true;
  error: string | null = null;

  // Modal
  mostrarModal = signal(false);
  productoEditando: (ProductoData & { gimnasio?: any }) | null = null;

  ngOnInit(): void {
    this.isAdmin = this.deducirEsAdminDesdeToken();
    this.cargar();
  }

  private deducirEsAdminDesdeToken(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
        ...(Array.isArray(decoded?.realm_access?.roles)
          ? decoded.realm_access.roles
          : []),
      ]
        .concat(
          [decoded?.role, decoded?.rol, decoded?.perfil].filter(
            Boolean
          ) as string[]
        )
        .map((r) => String(r).toUpperCase());
      return (
        decoded?.is_admin === true ||
        roles.includes('ADMIN') ||
        roles.includes('ROLE_ADMIN')
      );
    } catch {
      return false;
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
        // 👇 Solo productos activos (si no trae 'activo', se asume true)
        this.productos = (data ?? []).filter(
          (p) => p?.activo !== false
        ) as any[];
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
}
