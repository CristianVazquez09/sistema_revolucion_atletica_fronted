// src/app/pages/administracion/reportes/reportes.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReportesService } from 'src/app/services/reportes-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reportes.html'
})
export class Reportes implements OnInit {

  private fb = inject(FormBuilder);
  private reportesSrv = inject(ReportesService);
  private jwt = inject(JwtHelperService);

  // Rol
  isAdmin = false;

  // Estado gimnasios
  gimnasios: any[] = [];   // igual que en Paquetes: lo tratamos como any porque el backend manda id
  loadingGimnasios = false;

  // Estado descarga
  loadingExcel = false;
  errorMsg: string | null = null;

  // Form: idGimnasio opcional, fechas obligatorias
  form = this.fb.nonNullable.group({
    idGimnasio: [null as number | null],
    desde: ['', Validators.required],
    hasta: ['', Validators.required],
  });

  ngOnInit(): void {
    this.isAdmin = this.esAdminDesdeToken();
    console.log('[Reportes] isAdmin =', this.isAdmin);

    if (this.isAdmin) {
      this.cargarGimnasios();
    }
  }

  // ===== Rol desde token (igual patrón que en Paquete) =====
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

  // ===== Cargar gimnasios (solo admin) =====
  private cargarGimnasios(): void {
    this.loadingGimnasios = true;
    this.errorMsg = null;

    this.reportesSrv.listarGimnasios().subscribe({
      next: (data) => {
        this.gimnasios = data ?? [];
        this.loadingGimnasios = false;
        console.log('[Reportes] gimnasios cargados', this.gimnasios);
      },
      error: () => {
        this.loadingGimnasios = false;
        this.errorMsg = 'No se pudieron cargar los gimnasios.';
      }
    });
  }

  // ===== Helpers tipo Paquete (id / nombre) =====

  /** Obtiene el id numérico del gimnasio, ya sea `id` o `idGimnasio` */
  gymId(g: any): number | null {
    if (!g) return null;
    if (g.id != null) return g.id;
    if (g.idGimnasio != null) return g.idGimnasio;
    return null;
  }

  /** Muestra el nombre/identificador del gimnasio (igual idea que displayGimnasio en Paquete) */
  displayGimnasio(g: any): string {
    if (!g) return '—';
    const nombre = g.nombre ?? '';
    const id = this.gymId(g);
    if (nombre && nombre.trim().length) return nombre;
    if (id != null) return `#${id}`;
    return '—';
  }

  // ===== Descargar Excel =====
  descargar(): void {
    this.errorMsg = null;

    if (this.form.invalid) {
      this.errorMsg = 'Selecciona un rango de fechas válido.';
      this.form.markAllAsTouched();
      return;
    }

    let { idGimnasio, desde, hasta } = this.form.getRawValue();

    // Si NO es admin, ignoramos siempre idGimnasio -> usa tenant actual
    if (!this.isAdmin) {
      idGimnasio = null;
    }

    if (desde > hasta) {
      this.errorMsg = 'La fecha "Desde" no puede ser mayor que la fecha "Hasta".';
      return;
    }

    console.log('[Reportes] valores form', { idGimnasio, desde, hasta });

    this.loadingExcel = true;

    this.reportesSrv.descargarExcelMovimientos(idGimnasio, desde, hasta).subscribe({
      next: (blob) => {
        this.loadingExcel = false;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const gymSuffix = idGimnasio != null ? `_gym_${idGimnasio}` : '';
        a.download = `movimientos_${desde}_a_${hasta}${gymSuffix}.xlsx`;

        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.loadingExcel = false;
        this.errorMsg = 'No se pudo generar el reporte. Intenta de nuevo.';
      }
    });
  }
}
