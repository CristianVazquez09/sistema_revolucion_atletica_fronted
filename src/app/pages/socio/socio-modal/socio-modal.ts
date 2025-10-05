import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { SocioData } from '../../../model/socio-data';
import { GimnasioData } from '../../../model/gimnasio-data';
import { SocioService } from '../../../services/socio-service';
import { GimnasioService } from '../../../services/gimnasio-service';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-socio-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  titulo = computed(() => this.socio ? 'Editar socio' : 'Agregar socio');
  guardando = false;
  error: string | null = null;

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

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.error = null;
    this.guardando = true;

    const f = this.formulario.getRawValue();
    const gymId = this.isAdmin ? this.formulario.controls['gimnasioId'].value : null;

    // Construir payload
    const basePayload: SocioData = {
      idSocio: this.socio?.idSocio ?? 0,
      nombre: f.nombre!,
      apellido: f.apellido!,
      telefono: this.normalizarTelefono(f.telefono),
      email: f.email ?? '',
      direccion: f.direccion ?? '',
      genero: f.genero!,
      fechaNacimiento: f.fechaNacimiento!,
      comentarios: f.comentarios ?? ''
    };

    // Adjuntar gimnasio si es admin (el backend de socios puede usar id o idGimnasio; mandamos ambos)
    const payloadConGym: any = this.isAdmin && gymId
      ? { ...basePayload, gimnasio: { idGimnasio: Number(gymId), id: Number(gymId) } }
      : basePayload;

    const obs = this.socio
      ? this.socioService.actualizar(this.socio.idSocio, payloadConGym)
      : this.socioService.guardar(payloadConGym as SocioData);

    obs.subscribe({
      next: () => { this.guardando = false; this.guardado.emit(); },
      error: (err: any) => { console.error(err); this.guardando = false; this.error = 'No se pudo guardar el socio.'; }
    });
  }
}
