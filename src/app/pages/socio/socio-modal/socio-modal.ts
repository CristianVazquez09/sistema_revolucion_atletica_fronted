import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { SocioData } from '../../../model/socio-data';
import { GimnasioData } from '../../../model/gimnasio-data';
import { SocioService } from '../../../services/socio-service';
import { GimnasioService } from '../../../services/gimnasio-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { HuellaModal, HuellaResultado } from '../../huella-modal/huella-modal';

@Component({
  selector: 'app-socio-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HuellaModal],
  templateUrl: './socio-modal.html',
  styleUrl: './socio-modal.css'
})
export class SocioModal implements OnInit, OnDestroy {

  @Input() socio: SocioData | null = null;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  private socioService = inject(SocioService);
  private gymSrv        = inject(GimnasioService);
  private jwt           = inject(JwtHelperService);

  // Admin / gimnasios
  isAdmin = false;
  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;

  // Formulario
  formulario: FormGroup = new FormGroup({
    idSocio:         new FormControl(0),
    nombre:          new FormControl('', [Validators.required, Validators.maxLength(100)]),
    apellido:        new FormControl('', [Validators.required, Validators.maxLength(120)]),
    telefono:        new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
    email:           new FormControl('', [Validators.email, Validators.maxLength(120)]),
    direccion:       new FormControl('', [Validators.maxLength(200)]),
    genero:          new FormControl(null as 'MASCULINO' | 'FEMENINO' | 'OTRO' | null, [Validators.required]),
    fechaNacimiento: new FormControl(null as string | null, [Validators.required]),
    comentarios:     new FormControl(''),

    // ⚠️ Nace deshabilitado para evitar el warning; se habilita en TS cuando cargan los gimnasios
    gimnasioId:      new FormControl<number | null>({ value: null, disabled: true })
  });

  titulo     = computed(() => this.socio ? 'Editar socio' : 'Agregar socio');
  guardando  = false;
  error: string | null = null;

  // ===== Huella digital (para captura desde modal de huella) =====
  mostrarModalHuella = signal(false);
  huellaProceso      = signal(false);
  huellaMensaje      = signal<string | null>(null);
  huellaError        = signal<string | null>(null);
  huellaDigitalBase64: string | null = null; // usada en creación; en edición se envía directo al backend

  ngOnInit(): void {
    // 1) Rol admin
    this.isAdmin = this.deducirEsAdminDesdeToken();

    // 2) Si admin, preparar validador y cargar gimnasios
    if (this.isAdmin) {
      const gymCtrl = this.formulario.controls['gimnasioId'];
      gymCtrl.addValidators([Validators.required]);

      this.cargandoGimnasios = true;
      this.gymSrv.buscarTodos().subscribe({
        next: (lista) => {
          // Normaliza por si backend trae "id" en vez de "idGimnasio"
          this.gimnasios = (lista ?? []).map(g => ({
            idGimnasio: (g as any).idGimnasio ?? (g as any).id,
            nombre: g.nombre,
            direccion: g.direccion,
            telefono: g.telefono
          }));

          // Preselección: del socio si estás editando, si no, el primero
          const idPre =
            (this.socio?.gimnasio as any)?.idGimnasio ??
            (this.socio?.gimnasio as any)?.id ??
            this.gimnasios[0]?.idGimnasio ??
            null;

          if (idPre != null) {
            gymCtrl.setValue(Number(idPre), { emitEvent: false });
          }

          // Habilitar el select una vez cargados
          gymCtrl.enable({ emitEvent: false });
          this.cargandoGimnasios = false;
        },
        error: () => {
          this.cargandoGimnasios = false;
          // deja el select deshabilitado si falla
        }
      });
    }

    // 3) Si vienes a editar, cargar datos del socio y hacer patch
    if (this.socio) {
      this.socioService.buscarPorId(this.socio.idSocio).subscribe(s => {
        this.formulario.patchValue({
          idSocio: s.idSocio,
          nombre: s.nombre ?? '',
          apellido: s.apellido ?? '',
          telefono: this.normalizarTelefono(s.telefono),
          email: s.email ?? '',
          direccion: s.direccion ?? '',
          genero: s.genero ?? null,
          fechaNacimiento: s.fechaNacimiento ?? null,
          comentarios: s.comentarios ?? ''
        });

        if (this.isAdmin) {
          const gymCtrl = this.formulario.controls['gimnasioId'];
          const gymId = (s.gimnasio as any)?.idGimnasio ?? (s.gimnasio as any)?.id ?? null;
          if (gymId != null) {
            // puede que aún no haya cargado la lista; no pasa nada, ya tiene el valor
            gymCtrl.setValue(Number(gymId), { emitEvent: false });
          }
        }
      });
    }

    window.addEventListener('keydown', this.handleEsc);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleEsc);
  }

  private handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cancelar.emit();
  };

  private normalizarTelefono(v: unknown): string {
    return String(v ?? '').replace(/\D/g, '').slice(0, 10);
  }

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

  // ===== HUELLAS =====

  abrirModalHuella(): void {
    this.huellaError.set(null);
    this.huellaMensaje.set(null);
    this.mostrarModalHuella.set(true);
  }

  onHuellaCancel(): void {
    this.mostrarModalHuella.set(false);
  }

  onHuellaOk(res: HuellaResultado): void {
    this.mostrarModalHuella.set(false);

    const idx = this.elegirMejorIndice(res.calidades, res.muestras.length);
    const base = res.muestras[idx] ?? null;

    if (!base) {
      this.huellaError.set('No se recibió una muestra de huella válida.');
      return;
    }

    this.huellaDigitalBase64 = base;
    this.huellaError.set(null);

    // Si es edición → actualizar directo al backend
    if (this.socio?.idSocio) {
      this.huellaProceso.set(true);
      this.huellaMensaje.set('Actualizando huella del socio...');

      this.socioService.actualizarHuella(this.socio.idSocio, base).subscribe({
        next: () => {
          this.huellaProceso.set(false);
          this.huellaMensaje.set('Huella actualizada correctamente.');
        },
        error: (err) => {
          console.error('[SocioModal] error actualizando huella', err);
          this.huellaProceso.set(false);
          this.huellaError.set('No se pudo actualizar la huella. Intenta de nuevo.');
        }
      });
    } else {
      // Creación → se manda junto con el payload del socio
      this.huellaMensaje.set('Huella capturada. Se guardará al crear el socio.');
    }
  }

  private elegirMejorIndice(calidades: number[], total: number): number {
    if (!Array.isArray(calidades) || calidades.length !== total || total === 0) {
      return 0;
    }
    let bestIdx = 0;
    let bestVal = Number.POSITIVE_INFINITY;
    calidades.forEach((q, i) => {
      if (q < bestVal) {
        bestVal = q;
        bestIdx = i;
      }
    });
    return bestIdx;
  }

  // ===== GUARDAR SOCIO =====

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.error = null;
    this.guardando = true;

    const f = this.formulario.getRawValue();

    // Determinar/Conservar estado activo:
    // - Si es creación => true
    // - Si es edición  => conservar lo que tenga el socio; si viene undefined, forzar true
    const activo = this.socio ? (this.socio.activo !== false) : true;

    // Gimnasio a enviar:
    // - Admin: el seleccionado en el form
    // - No admin: conservar el mismo gimnasio del socio (si existe) para evitar que el backend lo borre con un replace
    let gymObj: { id: number } | undefined;
    if (this.isAdmin) {
      const gymId = this.formulario.controls['gimnasioId'].value;
      if (gymId != null) gymObj = { id: Number(gymId) };
    } else if (this.socio?.gimnasio) {
      const gid = (this.socio.gimnasio as any).id ?? (this.socio.gimnasio as any).idGimnasio;
      if (gid != null) gymObj = { id: Number(gid) };
    }

    // Construir payload COMPLETO (para backends que hacen replace)
    const basePayload: SocioData = {
      idSocio: this.socio?.idSocio ?? 0,
      nombre: f.nombre!,
      apellido: f.apellido!,
      telefono: this.normalizarTelefono(f.telefono),
      email: f.email ?? '',
      direccion: f.direccion ?? '',
      genero: f.genero!,
      fechaNacimiento: f.fechaNacimiento!,
      comentarios: f.comentarios ?? '',
      activo // <-- clave para NO perder el estado
    } as SocioData;

    // Si es creación y ya capturaste huella aquí, se manda junto al socio
    if (!this.socio && this.huellaDigitalBase64) {
      (basePayload as any).huellaDigital = this.huellaDigitalBase64;
    }

    const payload: any = gymObj ? { ...basePayload, gimnasio: gymObj } : basePayload;

    const obs = this.socio
      ? this.socioService.actualizar(this.socio.idSocio, payload)
      : this.socioService.guardar(payload as SocioData);

    obs.subscribe({
      next: () => {
        this.guardando = false;
        this.guardado.emit();
      },
      error: (err: any) => {
        console.error(err);
        this.guardando = false;
        this.error = 'No se pudo guardar el socio.';
      }
    });
  }
}
