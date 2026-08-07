import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';

import { PaqueteService } from '../../data/paquete-service';
import { PaqueteData } from '../../../../shared/models/paquete-data';
import { PaqueteModal } from './paquete-modal/paquete-modal';
import { NotificacionService } from '../../../../core/layout/notificacion-service';
import { TiempoPlanLabelPipe } from '../../../../shared/util/tiempo-plan-label';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../../environments/environment';
import { TipoPaquete } from '../../../../shared/util/enums/tipo-paquete';
import { MenuService } from 'src/app/core/layout/menu-service';
import { RaDropdown } from 'src/app/shared/ui/ra-dropdown/ra-dropdown';
import { RaBuscador } from 'src/app/shared/ui/ra-buscador/ra-buscador';

@Component({
  selector: 'app-paquete-componet',
  standalone: true,
  imports: [CommonModule, PaqueteModal, TiempoPlanLabelPipe, RaDropdown, RaBuscador],
  templateUrl: './paquete.html',
  styleUrl: './paquete.css',
})
export class Paquete implements OnInit {
  private notificacion = inject(NotificacionService);
  private servicioPaquetes = inject(PaqueteService);
  private jwt = inject(JwtHelperService);
  private menuSrv = inject(MenuService);

  menuAbierto = this.menuSrv.menuAbierto;

  // Rol
  isAdmin = false;

  // ✅ Buscador
  busqueda = signal('');

  // Estado de pantalla
  listaPaquetes: PaqueteData[] = [];
  estaCargando = true;
  mensajeError: string | null = null;

  // Estado de modal
  mostrarModalPaquete = signal(false);
  paqueteEnEdicion: PaqueteData | null = null;

  ngOnInit(): void {
    this.isAdmin = this.esAdminDesdeToken();
    this.cargarPaquetes();
  }

  private esAdminDesdeToken(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
        ...(Array.isArray(decoded?.realm_access?.roles) ? decoded.realm_access.roles : []),
      ]
        .concat([decoded?.role, decoded?.rol, decoded?.perfil].filter(Boolean) as string[])
        .map((r) => String(r).toUpperCase());

      return decoded?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch {
      return false;
    }
  }

  // ✅ handler buscador
  onBuscarChange(termino: string): void {
    this.busqueda.set(termino);

    if (!termino) {
      this.cargarPaquetes();
      return;
    }
    this.buscarPaquetesPorNombre(termino);
  }

  // Acciones
  cargarPaquetes(): void {
    this.estaCargando = true;
    this.mensajeError = null;

    this.servicioPaquetes
      .buscarTodos()
      .pipe(finalize(() => (this.estaCargando = false)))
      .subscribe({
        next: (data) => {
          this.listaPaquetes = (data ?? [])
            .filter((p) => p?.activo !== false)
            .map((p) => ({
              ...p,
              tipoPaquete: p.tipoPaquete ?? TipoPaquete.GIMNASIO,
            }))
            .sort((a, b) =>
              (a?.nombre ?? '').localeCompare(b?.nombre ?? '', 'es', { sensitivity: 'base' }),
            );
        },
        error: () => {
          this.mensajeError = 'No se pudo cargar la lista de paquetes.';
        },
      });
  }

  private buscarPaquetesPorNombre(nombre: string): void {
    this.estaCargando = true;
    this.mensajeError = null;

    // ✅ activo=true para mantener el comportamiento actual
    this.servicioPaquetes
      .buscarPorNombre(nombre, true)
      .pipe(finalize(() => (this.estaCargando = false)))
      .subscribe({
        next: (data) => {
          this.listaPaquetes = (data ?? [])
            .filter((p) => p?.activo !== false)
            .map((p) => ({
              ...p,
              tipoPaquete: p.tipoPaquete ?? TipoPaquete.GIMNASIO,
            }));
        },
        error: () => {
          this.mensajeError = 'No se pudo buscar paquetes.';
        },
      });
  }

  abrirModalParaCrear(): void {
    this.paqueteEnEdicion = null;
    this.mostrarModalPaquete.set(true);
  }

  abrirModalParaEditar(paquete: PaqueteData): void {
    this.paqueteEnEdicion = paquete;
    this.mostrarModalPaquete.set(true);
  }

  cerrarModalPaquete(): void {
    this.mostrarModalPaquete.set(false);
  }

  despuesDeGuardar(): void {
    this.cerrarModalPaquete();
    // respeta si había búsqueda activa
    const t = (this.busqueda() ?? '').trim();
    if (t) this.buscarPaquetesPorNombre(t);
    else this.cargarPaquetes();
  }

  desactivarPaquete(paquete: PaqueteData): void {
    if (!paquete?.idPaquete) return;
    if (!confirm(`¿Desactivar paquete "${paquete.nombre}"?`)) return;

    const actualizado: PaqueteData = {
      ...paquete,
      activo: false,
    };

    this.servicioPaquetes.actualizar(paquete.idPaquete, actualizado).subscribe({
      next: () => {
        this.notificacion.exito('Paquete desactivado.');
        const t = (this.busqueda() ?? '').trim();
        if (t) this.buscarPaquetesPorNombre(t);
        else this.cargarPaquetes();
      },
      error: () => this.notificacion.error('No se pudo desactivar el paquete.'),
    });
  }

  displayGimnasio(p: PaqueteData): string {
    const g: any = p?.gimnasio ?? {};
    const nombre = g?.nombre as string | undefined;
    const id = (g?.idGimnasio ?? g?.id) as number | undefined;
    if (nombre && nombre.trim().length) return nombre;
    if (id != null) return `#${id}`;
    return '—';
  }

  displayTipoPaquete(p: PaqueteData): string {
    const tipo = p?.tipoPaquete ?? TipoPaquete.GIMNASIO;
    switch (tipo) {
      case TipoPaquete.ZONA_COMBATE:
        return 'Zona de combate';
      case TipoPaquete.MIXTO:
        return 'Mixto';
      case TipoPaquete.GIMNASIO:
      default:
        return 'Gimnasio';
    }
  }
}
