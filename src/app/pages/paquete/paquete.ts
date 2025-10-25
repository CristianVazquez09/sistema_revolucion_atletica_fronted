import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';

import { PaqueteService } from '../../services/paquete-service';
import { PaqueteData } from '../../model/paquete-data';
import { PaqueteModal } from './paquete-modal/paquete-modal';
import { NotificacionService } from '../../services/notificacion-service';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-paquete-componet',
  standalone: true,
  imports: [CommonModule, PaqueteModal, TiempoPlanLabelPipe],
  templateUrl: './paquete.html',
  styleUrl: './paquete.css',
})
export class Paquete implements OnInit {

  private notificacion = inject(NotificacionService);
  private servicioPaquetes = inject(PaqueteService);
  private jwt = inject(JwtHelperService);

  // Rol
  isAdmin = false;

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
      .map(r => String(r).toUpperCase());
      return decoded?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch {
      return false;
    }
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
        // Muestra solo los activos (si alguno viene sin campo, lo tratamos como activo)
        this.listaPaquetes = (data ?? []).filter(p => p?.activo !== false);
      },
      error: () => { this.mensajeError = 'No se pudo cargar la lista de paquetes.'; },
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
    this.cargarPaquetes();
  }

  // src/app/pages/paquete/paquete.ts (tu componente)
// src/app/pages/paquete/paquete.ts
desactivarPaquete(paquete: PaqueteData): void {
  if (!paquete?.idPaquete) return;
  if (!confirm(`¿Desactivar paquete "${paquete.nombre}"?`)) return;

  // Clonamos y marcamos inactivo
  const actualizado: PaqueteData = {
    ...paquete,
    activo: false
  };

  this.servicioPaquetes.actualizar(paquete.idPaquete, actualizado).subscribe({
    next: () => {
      this.notificacion.exito('Paquete desactivado.');
      this.cargarPaquetes();
    },
    error: () => this.notificacion.error('No se pudo desactivar el paquete.'),
  });
}



  // Dentro de tu clase Paquete
displayGimnasio(p: PaqueteData): string {
  const g: any = p?.gimnasio ?? {};
  const nombre = g?.nombre as string | undefined;
  const id = (g?.idGimnasio ?? g?.id) as number | undefined; // backend a veces manda id, a veces idGimnasio
  if (nombre && nombre.trim().length) return nombre;
  if (id != null) return `#${id}`;
  return '—';
}


}
