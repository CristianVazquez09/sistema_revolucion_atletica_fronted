import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { PaqueteData } from '../../../model/paquete-data';
import { TiempoPlan } from '../../../util/enums/tiempo-plan';
import { TiempoPlanLabelPipe } from '../../../util/tiempo-plan-label';

import { PaqueteService } from '../../../services/paquete-service';
import { GimnasioService } from '../../../services/gimnasio-service';
import { GimnasioData } from '../../../model/gimnasio-data';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-paquete-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TiempoPlanLabelPipe],
  templateUrl: './paquete-modal.html'
})
export class PaqueteModal implements OnInit, OnDestroy {

  @Input() paquete: PaqueteData | null = null;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  private paqueteService = inject(PaqueteService);
  private gimnasioService = inject(GimnasioService);
  private jwt = inject(JwtHelperService);

  isAdmin = false;

  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;

  // Enum -> opciones
  tiempos = (Object.values(TiempoPlan).filter(v => typeof v === 'string') as string[]) as unknown as TiempoPlan[];

  titulo = computed(() => this.paquete ? 'Editar paquete' : 'Agregar paquete');

  fb: FormGroup = new FormGroup({
    idPaquete:         new FormControl(0),
    nombre:            new FormControl('', [Validators.required, Validators.maxLength(100)]),
    tiempo:            new FormControl(null as TiempoPlan | null, [Validators.required]),
    precio:            new FormControl(0, [Validators.required, Validators.min(0)]),
    costoInscripcion:  new FormControl(0, [Validators.required, Validators.min(0)]),
    // SOLO admin: requerido
    gimnasioId:        new FormControl<number | null>(null)
  });

  guardando = false;
  error: string | null = null;
  intentoGuardar = false;

  ngOnInit(): void {
    this.isAdmin = this.esAdminDesdeToken();

    if (this.isAdmin) {
      this.fb.controls['gimnasioId'].addValidators([Validators.required]);
      this.cargarGimnasios(() => this.precargarEdicion());
    } else {
      this.precargarEdicion();
    }

    window.addEventListener('keydown', this.handleEsc);
  }

  ngOnDestroy(): void { window.removeEventListener('keydown', this.handleEsc); }
  private handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') this.cancelar.emit(); };

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

  private cargarGimnasios(done?: () => void): void {
    this.cargandoGimnasios = true;
    this.gimnasioService.buscarTodos().subscribe({
      next: (lista) => {
        // Normaliza para tener siempre idGimnasio
        const vistos = new Set<number>();
        this.gimnasios = (lista ?? []).map((g: any) => ({
          idGimnasio: typeof g.idGimnasio === 'number' ? g.idGimnasio : Number(g.id),
          nombre: g.nombre,
          direccion: g.direccion,
          telefono: g.telefono
        } as GimnasioData)).filter(g => {
          if (!g.idGimnasio) return false;
          if (vistos.has(g.idGimnasio)) return false;
          vistos.add(g.idGimnasio);
          return true;
        });

        // Si no estamos editando, preselecciona el primero
        if (!this.paquete && this.gimnasios.length) {
          this.fb.controls['gimnasioId'].setValue(this.gimnasios[0].idGimnasio);
        }
        this.cargandoGimnasios = false;
        done?.();
      },
      error: () => { this.cargandoGimnasios = false; done?.(); }
    });
  }

  private precargarEdicion(): void {
    if (!this.paquete) return;

    // Patch de campos básicos
    this.fb.patchValue({
      idPaquete:        this.paquete.idPaquete,
      nombre:           this.paquete.nombre,
      tiempo:           this.paquete.tiempo,
      precio:           this.paquete.precio,
      costoInscripcion: this.paquete.costoInscripcion,
    });

    // Si es admin, trae y coloca gimnasioId del paquete (id o idGimnasio)
    if (this.isAdmin) {
      const anyG = this.paquete.gimnasio as any;
      const gymId = (typeof anyG?.idGimnasio === 'number' ? anyG.idGimnasio :
                    (typeof anyG?.id === 'number' ? anyG.id : null));
      if (gymId != null) {
        this.fb.controls['gimnasioId'].setValue(gymId);
      }
    }
  }

  guardar(): void {
    this.intentoGuardar = true;
    if (this.fb.invalid) {
      this.fb.markAllAsTouched();
      return;
    }

    this.error = null;
    this.guardando = true;

    const f = this.fb.getRawValue();

    // Construir payload
    const base = {
      nombre: f.nombre,
      tiempo: f.tiempo,
      precio: Number(f.precio),
      costoInscripcion: Number(f.costoInscripcion),
    };

    const payloadCrear: any = {
      ...base,
      ...(this.isAdmin && f.gimnasioId != null ? { gimnasio: { id: Number(f.gimnasioId) } } : {})
    };

    const payloadUpdate: any = {
      idPaquete: Number(f.idPaquete ?? this.paquete?.idPaquete),
      ...base,
      ...(this.isAdmin && f.gimnasioId != null ? { gimnasio: { id: Number(f.gimnasioId) } } : {})
    };

    const obs = this.paquete
      ? this.paqueteService.actualizar(payloadUpdate.idPaquete, payloadUpdate)
      : this.paqueteService.guardar(payloadCrear as PaqueteData);

    obs.subscribe({
      next: () => {
        this.guardando = false;
        this.guardado.emit();
      },
      error: (err) => {
        console.error(err);
        this.guardando = false;
        this.error = 'No se pudo guardar el paquete.';
      }
    });
  }
}
