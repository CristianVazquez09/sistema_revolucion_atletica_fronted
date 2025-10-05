import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { ProductoData } from '../../../model/producto-data';
import { CategoriaData } from '../../../model/categoria-data';
import { GimnasioData } from '../../../model/gimnasio-data';

import { ProductoService } from '../../../services/producto-service';
import { CategoriaService } from '../../../services/categoria-service';
import { GimnasioService } from '../../../services/gimnasio-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-producto-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './producto-modal.html',
  styleUrl: './producto-modal.css'
})
export class ProductoModal implements OnInit, OnDestroy {

  @Input() producto: ProductoData | null = null;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  private fb           = inject(FormBuilder);
  private productoSrv  = inject(ProductoService);
  private categoriaSrv = inject(CategoriaService);
  private gimnasioSrv  = inject(GimnasioService);
  private jwt          = inject(JwtHelperService);

  isAdmin = false;

  gimnasios: GimnasioData[] = [];
  categorias: CategoriaData[] = [];
  categoriasFiltradas: CategoriaData[] = [];

  cargandoGimnasios = false;
  cargandoCategorias = false;

  titulo = computed(() => this.producto ? 'Editar producto' : 'Agregar producto');
  guardando = false;
  error: string | null = null;
  intentoGuardar = false;

  form = this.fb.group({
    gimnasioId:   this.fb.control<number | null>(null), // required solo si admin
    nombre:       this.fb.control('',  [Validators.required, Validators.maxLength(120)]),
    codigo:       this.fb.control('',  [Validators.maxLength(60)]),
    precioCompra: this.fb.control(0,   [Validators.required, Validators.min(0)]),
    precioVenta:  this.fb.control(0,   [Validators.required, Validators.min(0)]),
    cantidad:     this.fb.control(0,   [Validators.required, Validators.min(0)]),
    idCategoria:  this.fb.control<number | null>(null, [Validators.required]),
  });

  ngOnInit(): void {
    this.isAdmin = this.esAdminDesdeToken();

    if (this.isAdmin) {
      this.form.controls.gimnasioId.addValidators([Validators.required]);
      this.cargarGimnasios(() => {
        this.cargarCategorias(() => {
          this.precargarEdicion();
          this.refiltrarCategoriasPorGym();
        });
      });
      this.form.controls.gimnasioId.valueChanges.subscribe(() => this.refiltrarCategoriasPorGym());
    } else {
      this.cargarCategorias(() => this.precargarEdicion());
    }

    window.addEventListener('keydown', this.handleEsc);
  }

  ngOnDestroy(): void { window.removeEventListener('keydown', this.handleEsc); }
  private handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') this.cancelar.emit(); };

  // ===== Cargas =====
  private cargarGimnasios(done?: () => void): void {
    this.cargandoGimnasios = true;
    this.gimnasioSrv.buscarTodos().subscribe({
      next: (lista) => {
        // Normaliza: siempre idGimnasio
        const vistos = new Set<number>();
        this.gimnasios = (lista ?? [])
          .map((g: any) => ({
            idGimnasio: typeof g.idGimnasio === 'number' ? g.idGimnasio : Number(g.id),
            nombre: g.nombre,
            direccion: g.direccion,
            telefono: g.telefono
          } as GimnasioData))
          .filter(g => {
            if (!g.idGimnasio) return false;
            if (vistos.has(g.idGimnasio)) return false;
            vistos.add(g.idGimnasio);
            return true;
          });

        this.cargandoGimnasios = false;

        // Si no es edición, preselecciona el primero
        if (!this.producto && this.gimnasios.length) {
          this.form.controls.gimnasioId.setValue(this.gimnasios[0].idGimnasio, { emitEvent: false });
        }

        done?.();
      },
      error: () => { this.cargandoGimnasios = false; done?.(); }
    });
  }

  private cargarCategorias(done?: () => void): void {
    this.cargandoCategorias = true;
    this.categoriaSrv.buscarTodos().subscribe({
      next: (data) => {
        this.categorias = data ?? [];
        this.cargandoCategorias = false;

        if (!this.isAdmin) {
          this.categoriasFiltradas = [...this.categorias];
        }

        done?.();
      },
      error: () => {
        this.cargandoCategorias = false;
        this.error = 'No se pudieron cargar categorías.';
        done?.();
      }
    });
  }

  private precargarEdicion(): void {
    if (!this.producto) return;

    if (this.isAdmin) {
      const gymId = this.resolveCategoriaGymId(this.producto.categoria) ?? this.resolveGymIdFromObj(this.producto.gimnasio);
      if (gymId != null) {
        this.form.controls.gimnasioId.setValue(gymId, { emitEvent: false });
      }
    }

    this.form.patchValue({
      nombre: String(this.producto.nombre ?? ''),
      codigo: String(this.producto.codigo ?? ''),
      precioCompra: Number(this.producto.precioCompra ?? 0),
      precioVenta: Number(this.producto.precioVenta ?? 0),
      cantidad: Number(this.producto.cantidad ?? 0),
      idCategoria: this.producto.categoria?.idCategoria ?? null,
    });
  }

  // ===== Filtro por gimnasio (admin) =====
  private refiltrarCategoriasPorGym(): void {
    if (!this.isAdmin) return;

    const gid = this.form.controls.gimnasioId.value;
    if (gid == null) {
      this.categoriasFiltradas = [];
      this.form.controls.idCategoria.setValue(null, { emitEvent: false });
      return;
    }

    this.categoriasFiltradas = this.categorias.filter(c => {
      const cg = this.resolveCategoriaGymId(c);
      return cg != null && Number(cg) === Number(gid);
    });

    const actual = this.form.controls.idCategoria.value;
    if (actual != null && !this.categoriasFiltradas.some(c => c.idCategoria === actual)) {
      this.form.controls.idCategoria.setValue(null, { emitEvent: false });
    }
  }

  // ===== Helpers =====
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
    } catch { return false; }
  }

  // Soporta { gimnasio: { id } } o { gimnasio: { idGimnasio } }
  private resolveCategoriaGymId(c?: CategoriaData | null): number | null {
    if (!c?.gimnasio) return null;
    const anyG: any = c.gimnasio as any;
    if (typeof anyG.id === 'number') return anyG.id;
    if (typeof anyG.idGimnasio === 'number') return anyG.idGimnasio;
    return null;
  }
  private resolveGymIdFromObj(g?: Partial<GimnasioData> | { id?: number } | null): number | null {
    if (!g) return null;
    const anyG: any = g;
    if (typeof anyG.idGimnasio === 'number') return anyG.idGimnasio;
    if (typeof anyG.id === 'number') return anyG.id;
    return null;
  }

  gimNombrePorId(id?: number | null): string {
    if (id == null) return '';
    const g = this.gimnasios.find(x => x.idGimnasio === Number(id));
    return g?.nombre ?? `#${id}`;
  }

  catOptionText(c: CategoriaData): string {
    // Etiqueta: "Nombre — Gimnasio"
    const gymNombre = (c as any)?.gimnasio?.nombre ? ` — ${(c as any).gimnasio.nombre}` : '';
    return `${c.nombre}${gymNombre}`;
  }

  // ===== Guardar =====
  submit(): void {
    this.intentoGuardar = true;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.error = null;
    this.guardando = true;

    const f = this.form.getRawValue();

    // Construir DTO para backend
    const dto: any = {
      ...(this.producto?.idProducto ? { idProducto: this.producto.idProducto } : {}),
      nombre: f.nombre,
      codigo: f.codigo,
      precioCompra: Number(f.precioCompra),
      precioVenta: Number(f.precioVenta),
      cantidad: Number(f.cantidad),
      categoria: { idCategoria: f.idCategoria! } // tu backend espera "idCategoria" en CategoriaDTO
    };

    if (this.isAdmin && f.gimnasioId != null) {
      dto.gimnasio = { id: Number(f.gimnasioId) }; // lo que espera ProductoDTO
    }

    const obs = this.producto?.idProducto
      ? this.productoSrv.actualizar(this.producto.idProducto!, dto)
      : this.productoSrv.guardar(dto);

    obs.subscribe({
      next: () => { this.guardando = false; this.guardado.emit(); },
      error: (err) => { console.error(err); this.guardando = false; this.error = 'No se pudo guardar el producto.'; }
    });
  }
}
