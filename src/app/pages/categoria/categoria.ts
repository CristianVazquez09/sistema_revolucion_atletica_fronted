import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, signal } from '@angular/core';
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
export class Categoria implements OnInit, AfterViewInit, OnDestroy {

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

  // ===================== ZOOM / LAYOUT =====================
  @ViewChild('zoomOuter', { static: true }) zoomOuter!: ElementRef<HTMLElement>;

  uiZoom = 1;
  categoriasMaxH = 320;

  private ro?: ResizeObserver;

  // “Poquito” más chico en md/lg/xl
  private readonly MIN_ZOOM = 0.86;
  private readonly MAX_ZOOM = 1.0;

  // Breakpoint md para no encoger tarjetas/inputs en mobile
  esMdUp = signal(
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : false
  );

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

  ngAfterViewInit(): void {
    this.applyLayout();

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.applyLayout());
      this.ro.observe(this.zoomOuter.nativeElement);
    }

    window.addEventListener('resize', this.applyLayout);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    window.removeEventListener('resize', this.applyLayout);
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private getDesignWidth(): number {
    // Admin tiene una columna extra (Gimnasio), entonces “diseño” un poco más ancho
    return this.isAdmin ? 1180 : 1000;
  }

  private applyLayout = (): void => {
    if (typeof window === 'undefined') return;

    this.esMdUp.set(window.matchMedia('(min-width: 768px)').matches);

    // Mobile: no encoger
    if (!this.esMdUp()) {
      this.uiZoom = 1;
      const offsetMobile = 360; // header + form + paddings aprox
      const available = window.innerHeight - offsetMobile;
      this.categoriasMaxH = Math.max(240, Math.floor(available));
      return;
    }

    const w = this.zoomOuter.nativeElement.clientWidth;
    const design = this.getDesignWidth();
    const z = this.clamp(w / design, this.MIN_ZOOM, this.MAX_ZOOM);
    this.uiZoom = this.round2(z);

    // Alto disponible para el scroller de la tabla
    const offsetDesktop = this.isAdmin ? 520 : 480; // header + form + paddings aprox
    const available = window.innerHeight - offsetDesktop;

    // Compensar zoom para que el alto visible sea el correcto
    this.categoriasMaxH = Math.max(240, Math.floor(available / this.uiZoom));
  };

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
        // Solo activas (si no trae campo, se asume activa)
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

    // si estás editando, respeta el valor actual de 'activo'; si es alta, true
    const activo = this.categoriaEditando?.activo ?? true;

    const payload: any = { nombre, activo };

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
      gimnasioId: this.isAdmin
        ? (this.getGymId(c.gimnasio) ?? this.form.controls.gimnasioId.value)
        : null
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

  // --- Eliminar (desactivar) ---
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
