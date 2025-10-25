import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { CategoriaService } from '../../services/categoria-service';
import { CategoriaData } from '../../model/categoria-data';
import { NotificacionService } from '../../services/notificacion-service';

import { GimnasioService } from '../../services/gimnasio-service';
import { GimnasioData } from '../../model/gimnasio-data';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-categoria',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './categoria.html',
  styleUrl: './categoria.css'
})
export class Categoria implements OnInit {

  // Inyección
  private fb = inject(FormBuilder);
  private categoriaSrv = inject(CategoriaService);
  private notificacion = inject(NotificacionService);

  private gimnasioSrv = inject(GimnasioService);
  private jwt = inject(JwtHelperService);

  // Estado admin/tenant
  isAdmin = false;

  // Estado
  categorias: CategoriaData[] = [];
  loading = true;
  error: string | null = null;

  // Gimnasios (solo admin)
  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;
  errorGimnasios: string | null = null;

  // Modo edición (null = crear)
  private categoriaEditando: CategoriaData | null = null;

  // Form: gimnasioId se habilita solo si eres admin
  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    gimnasioId: this.fb.control<number | null>({ value: null, disabled: true })
  });

  guardando = false;

  ngOnInit(): void {
    this.isAdmin = this.deducirEsAdminDesdeToken();

    if (this.isAdmin) {
      this.form.controls.gimnasioId.addValidators([Validators.required]);
      this.cargarGimnasiosYLuegoCategorias();
    } else {
      this.form.controls.gimnasioId.clearValidators();
      this.form.controls.gimnasioId.disable({ emitEvent: false });
      this.cargarCategorias();
    }
  }

  // === helpers id/label compatibles con id || idGimnasio ===
  getGymId(obj: any): number | null {
    if (!obj) return null;
    const id = obj.id ?? obj.idGimnasio ?? null;
    return id != null ? Number(id) : null;
  }
  gymLabel(obj: any): string {
    const id = this.getGymId(obj);
    return obj?.nombre ?? (id != null ? `#${id}` : '—');
  }

  // --- Helpers de rol ---
  private deducirEsAdminDesdeToken(): boolean {
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

  // --- Cargas ---
  private cargarGimnasiosYLuegoCategorias(): void {
    this.cargandoGimnasios = true;
    this.errorGimnasios = null;

    this.gimnasioSrv.buscarTodos().subscribe({
      next: (lista) => {
        this.gimnasios = (lista ?? []).filter(Boolean);
        const pre = this.getGymId(this.gimnasios[0]);
        if (pre != null) {
          this.form.controls.gimnasioId.setValue(pre, { emitEvent: false });
        }
        this.form.controls.gimnasioId.enable({ emitEvent: false });
        this.cargandoGimnasios = false;
        this.cargarCategorias();
      },
      error: () => {
        this.cargandoGimnasios = false;
        this.errorGimnasios = 'No se pudieron cargar los gimnasios.';
        this.cargarCategorias();
      }
    });
  }

  private cargarCategorias(): void {
  this.loading = true;
  this.error = null;

  this.categoriaSrv.buscarTodos().subscribe({
    next: data => {
      // 👇 Solo mostrar activas (si no trae campo, se asume activa)
      this.categorias = (data ?? []).filter(c => c?.activo !== false);
      this.loading = false;
    },
    error: err => {
      console.error(err);
      this.loading = false;
      this.error = 'No se pudieron cargar las categorías.';
    }
  });
}


  // --- Guardar (crear/actualizar) ---
  guardar(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.guardando = true;

    const nombre = String(this.form.controls.nombre.value ?? '').trim();
    const payload: any = { nombre };

    // ⬅️ IMPORTANTE: enviar gimnasio como { id } cuando eres admin
    if (this.isAdmin) {
      if (this.form.controls.gimnasioId.disabled) {
        this.form.controls.gimnasioId.enable({ emitEvent: false });
      }
      const idG = this.form.controls.gimnasioId.value;
      if (idG != null) payload.gimnasio = { id: Number(idG) };
    }

    const esEdicion = !!this.categoriaEditando?.idCategoria;
    const obs = esEdicion
      ? this.categoriaSrv.actualizar(this.categoriaEditando!.idCategoria!, payload)
      : this.categoriaSrv.guardar(payload);

    obs.subscribe({
      next: () => {
        this.guardando = false;
        this.cancelarEdicion();
        this.cargarCategorias();
        this.notificacion.exito('Categoría guardada.');
      },
      error: err => {
        console.error(err);
        this.guardando = false;
        this.notificacion.error('No se pudo guardar la categoría.');
      }
    });
  }

  // --- Edición ---
  editar(c: CategoriaData): void {
    this.categoriaEditando = c;
    if (this.isAdmin) this.form.controls.gimnasioId.enable({ emitEvent: false });

    this.form.reset({
      nombre: String(c.nombre ?? ''),
      // soporta backend que devuelva gimnasio.id o gimnasio.idGimnasio
      gimnasioId: this.isAdmin ? (this.getGymId(c.gimnasio) ?? this.form.controls.gimnasioId.value) : null
    });
  }

  cancelarEdicion(): void {
    this.categoriaEditando = null;
    if (this.isAdmin) {
      this.form.reset({
        nombre: '',
        gimnasioId: this.form.controls.gimnasioId.enabled
          ? (this.form.controls.gimnasioId.value ?? null)
          : null
      });
    } else {
      this.form.reset({ nombre: '', gimnasioId: null });
      this.form.controls.gimnasioId.disable({ emitEvent: false });
    }
  }

  // --- Eliminar ---
  desactivar(c: CategoriaData) {
  if (!c?.idCategoria) return;
  if (!confirm(`¿Desactivar categoría "${c.nombre}"?`)) return;

  const actualizado: CategoriaData = { ...c, activo: false };

  this.categoriaSrv.actualizar(c.idCategoria, actualizado).subscribe({
    next: () => {
      this.notificacion.exito('Categoría desactivada.');
      this.cargarCategorias();
    },
    error: () => this.notificacion.error('No se pudo desactivar la categoría.')
  });
}


  // --- Helpers de template ---
  get esEdicion(): boolean { return !!this.categoriaEditando; }
  get idEditando(): number | null { return this.categoriaEditando?.idCategoria ?? null; }
}
