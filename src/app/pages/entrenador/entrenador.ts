import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { EntrenadorService } from '../../services/entrenador-service';
import { GimnasioService } from '../../services/gimnasio-service';
import { NotificacionService } from '../../services/notificacion-service';

import { EntrenadorData } from '../../model/entrenador-data';
import { GimnasioData } from '../../model/gimnasio-data';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-entrenador',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './entrenador.html',
  styleUrl: './entrenador.css',
})
export class Entrenador implements OnInit {
  // Inyección
  private fb = inject(FormBuilder);
  private entrenadorSrv = inject(EntrenadorService);
  private gimnasioSrv = inject(GimnasioService);
  private noti = inject(NotificacionService);
  private jwt = inject(JwtHelperService);

  // Admin
  isAdmin = false;

  // Estado listado
  entrenadores: EntrenadorData[] = [];
  loading = true;
  error: string | null = null;

  // Estado gimnasios (solo admin)
  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;

  // Modo edición
  private entrenadorEditando: EntrenadorData | null = null;

  // Formulario
  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido: ['', [Validators.required, Validators.maxLength(120)]],
    // Nace deshabilitado para evitar warnings; se habilita cuando se cargan gimnasios
    gimnasioId: [{ value: null as number | null, disabled: true }],
  });

  guardando = false;

  tituloForm = computed(() =>
    this.entrenadorEditando ? 'Editar entrenador' : 'Agregar entrenador'
  );

  ngOnInit(): void {
    // Resolver rol
    this.isAdmin = this.deducirEsAdminDesdeToken();

    if (this.isAdmin) {
      // Validar gimnasio obligatorio para admin
      this.form.controls.gimnasioId.addValidators([Validators.required]);

      // Cargar gimnasios y habilitar select
      this.cargandoGimnasios = true;
      this.gimnasioSrv.buscarTodos().subscribe({
        next: (lista) => {
          // Normaliza por si el backend usa "id" en vez de "idGimnasio"
          this.gimnasios = (lista ?? []).map((g) => ({
            idGimnasio: (g as any).idGimnasio ?? (g as any).id,
            nombre: g.nombre,
            direccion: g.direccion,
            telefono: g.telefono,
          }));
          // Preselecciona el primero si estamos creando
          if (!this.entrenadorEditando && this.gimnasios.length) {
            this.form.controls.gimnasioId.setValue(
              this.gimnasios[0].idGimnasio,
              { emitEvent: false }
            );
          }
          this.form.controls.gimnasioId.enable({ emitEvent: false });
          this.cargandoGimnasios = false;
          this.cargar();
        },
        error: () => {
          this.cargandoGimnasios = false;
          this.cargar(); // igual carga la lista
        },
      });
    } else {
      this.cargar();
    }
  }

  // --- helpers ---
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

  // --- CRUD ---
  cargar(): void {
    this.loading = true;
    this.error = null;
    this.entrenadorSrv.buscarTodos().subscribe({
      next: (data) => {
        this.entrenadores = data ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.error = 'No se pudieron cargar los entrenadores.';
      },
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando = true;

    const nombre = String(this.form.controls.nombre.value ?? '').trim();
    const apellido = String(this.form.controls.apellido.value ?? '').trim();

    // payload base
    let payload: any = { nombre, apellido };

    // Si admin: adjunta gimnasio como { id: X } (requisito backend)
    if (this.isAdmin) {
      const gymId = this.form.controls.gimnasioId.value;
      if (gymId) {
        payload.gimnasio = { id: Number(gymId) };
      }
    }

    const obs = this.entrenadorEditando?.idEntrenador
      ? this.entrenadorSrv.actualizar(
          this.entrenadorEditando.idEntrenador,
          payload
        )
      : this.entrenadorSrv.guardar(payload);

    obs.subscribe({
      next: () => {
        this.guardando = false;
        this.noti.exito('Entrenador guardado.');
        this.cancelarEdicion();
        this.cargar();
      },
      error: (err) => {
        console.error(err);
        this.guardando = false;
        this.noti.error('No se pudo guardar el entrenador.');
      },
    });
  }

  editar(e: EntrenadorData): void {
    this.entrenadorEditando = e;
    const gymId =
      (e.gimnasio as any)?.idGimnasio ?? (e.gimnasio as any)?.id ?? null;

    this.form.reset({
      nombre: String(e.nombre ?? ''),
      apellido: String(e.apellido ?? ''),
      gimnasioId: this.isAdmin
        ? gymId !== null
          ? Number(gymId)
          : this.form.controls.gimnasioId.value
        : null,
    });

    // Asegura que el control esté habilitado si admin y ya cargamos gimnasios
    if (
      this.isAdmin &&
      !this.cargandoGimnasios &&
      this.form.controls.gimnasioId.disabled
    ) {
      this.form.controls.gimnasioId.enable({ emitEvent: false });
    }
  }

  cancelarEdicion(): void {
    this.entrenadorEditando = null;
    this.form.reset({
      nombre: '',
      apellido: '',
      gimnasioId: this.isAdmin ? this.gimnasios[0]?.idGimnasio ?? null : null,
    });
  }

  eliminar(e: EntrenadorData): void {
    if (!e.idEntrenador) return;
    if (!confirm(`¿Eliminar entrenador "${e.nombre} ${e.apellido}"?`)) return;

    this.entrenadorSrv.eliminar(e.idEntrenador).subscribe({
      next: () => this.cargar(),
      error: () => this.noti.error('No se pudo eliminar el entrenador.'),
    });
  }

  // Helpers template
  get esEdicion(): boolean {
    return !!this.entrenadorEditando;
  }
  get idEditando(): number | null {
    return this.entrenadorEditando?.idEntrenador ?? null;
  }

  // Muestra nombre del gimnasio; si no hay, muestra #id (acepta id o idGimnasio)
  gymLabel(
    g?: { nombre?: string; id?: number; idGimnasio?: number } | null
  ): string {
    if (!g) return '';
    if (g.nombre) return g.nombre;
    const id = g.idGimnasio ?? g.id;
    return id != null ? `#${id}` : '';
  }
}
