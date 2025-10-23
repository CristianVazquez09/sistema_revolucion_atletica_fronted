import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { UsuarioService } from '../../../../services/usuario-service';
import { GimnasioService } from '../../../../services/gimnasio-service';
import { RolService } from '../../../../services/rol-service';

import { UsuarioData } from '../../../../model/usuario-data';
import { RolData } from '../../../../model/rol-data';

type GymOption = { id: number; nombre: string; direccion?: string; telefono?: string };

@Component({
  selector: 'app-usuarios-admin-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios-admin-modal.html',
  styleUrl: './usuarios-admin-modal.css'
})
export class UsuariosAdminModal implements OnInit {

  @Input() idUsuario: number | null = null;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  private srv    = inject(UsuarioService);
  private gymSrv = inject(GimnasioService);
  private rolSrv = inject(RolService);

  roles: RolData[] = [];
  gimnasios: GymOption[] = [];

  form = new FormGroup({
    nombreUsuario: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)]
    }),
    contrasenia: new FormControl<string>('', { nonNullable: true }), // requerida solo al crear
    activo: new FormControl<boolean>(true, { nonNullable: true }),
    rolNombre: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    gimnasioId: new FormControl<number | null>(null)
  });

  data: UsuarioData | null = null;
  cargando = true;
  guardando = false;
  error: string | null = null;

  trackGymBy = (_: number, g: GymOption) => g.id;
  get esCrear(): boolean { return !this.idUsuario; }

  ngOnInit(): void {
    this.cargando = true;

    this.rolSrv.buscarTodos().subscribe({
      next: (rs) => {
        this.roles = (rs ?? []).filter(Boolean);
        if (this.esCrear && !this.form.controls.rolNombre.value && this.roles.length) {
          this.form.controls.rolNombre.setValue(this.roles[0].nombre, { emitEvent: false });
        }
        this.updateContraseniaValidator(this.esCrear);
        this.cargarGimnasios();
      },
      error: () => {
        this.roles = [
          { nombre: 'ADMIN' },
          { nombre: 'GERENTE' },
          { nombre: 'RECEPCIONISTA' },
        ];
        if (this.esCrear && !this.form.controls.rolNombre.value) {
          this.form.controls.rolNombre.setValue(this.roles[0].nombre, { emitEvent: false });
        }
        this.updateContraseniaValidator(this.esCrear);
        this.cargarGimnasios();
      }
    });
  }

  private cargarGimnasios(): void {
    this.gymSrv.buscarTodos().subscribe({
      next: (lista: any[]) => {
        this.gimnasios = (lista ?? [])
          .map(g => ({
            id: (g as any).id ?? (g as any).idGimnasio,
            nombre: g.nombre,
            direccion: g.direccion,
            telefono: g.telefono
          }))
          .filter(g => Number(g.id) > 0) as GymOption[];
        this.initUsuario();
      },
      error: () => { this.gimnasios = []; this.initUsuario(); }
    });
  }

  private getGymIdFlexible(g: any): number | null {
    if (!g) return null;
    const id = g.id ?? g.idGimnasio ?? null;
    return id != null ? Number(id) : null;
  }

  private updateContraseniaValidator(required: boolean) {
    const c = this.form.controls.contrasenia;
    c.clearValidators();
    if (required) c.addValidators([Validators.required, Validators.minLength(6)]);
    c.updateValueAndValidity({ emitEvent: false });
  }

  private initUsuario(): void {
    if (this.esCrear) {
      if (!this.form.controls.rolNombre.value && this.roles.length) {
        this.form.controls.rolNombre.setValue(this.roles[0].nombre, { emitEvent: false });
      }
      this.cargando = false;
      return;
    }

    this.srv.buscarPorId(this.idUsuario!).subscribe({
      next: (u) => {
        this.data = u;
        const gymId = this.getGymIdFlexible((u as any).gimnasio);

        this.form.patchValue({
          nombreUsuario: u.nombreUsuario,
          contrasenia: '',
          activo: !!u.activo,
          rolNombre: (u.roles?.[0]?.nombre ?? this.roles?.[0]?.nombre ?? ''),
          gimnasioId: gymId
        }, { emitEvent: false });

        this.updateContraseniaValidator(false);
        this.cargando = false;
      },
      error: () => { this.error = 'No se pudo cargar el usuario.'; this.cargando = false; }
    });
  }

  guardar(): void {
    console.log('[UsuariosAdminModal] submit'); // <- para verificar que entra
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      console.log('[UsuariosAdminModal] form invalid', this.form.getRawValue(), this.form.status, this.form.errors);
      return;
    }

    const f = this.form.getRawValue();
    const gymId = f.gimnasioId != null ? Number(f.gimnasioId) : 0;
    const gimnasioPayload = gymId > 0 ? { gimnasio: { id: gymId } } : {};

    if (this.esCrear) {
      const payload: any = {
        nombreUsuario: f.nombreUsuario!.trim(),
        contrasenia:   f.contrasenia!.trim(),
        activo:        !!f.activo,
        rol:           f.rolNombre!,
        ...gimnasioPayload
      };

      console.log('[UsuariosAdminModal] POST payload:', payload);

      this.guardando = true;
      this.srv.guardar(payload).subscribe({
        next: () => { this.guardando = false; this.guardado.emit(); },
        error: (err) => {
          this.guardando = false;
          this.error = (err?.status === 409)
            ? (err?.error?.detail || 'Ese nombre de usuario ya existe.')
            : (err?.error?.detail || 'No se pudo crear el usuario.');
        }
      });
      return;
    }

    const upd: any = {
      nombreUsuario: f.nombreUsuario!.trim(),
      activo:        !!f.activo,
      ...gimnasioPayload
    };
    if (f.rolNombre) upd.rol = f.rolNombre;
    if (f.contrasenia && f.contrasenia.trim().length > 0) {
      upd.contrasenia = f.contrasenia.trim();
    }

    console.log('[UsuariosAdminModal] PUT payload:', upd);

    this.guardando = true;
    this.srv.actualizar(this.idUsuario!, upd).subscribe({
      next: () => { this.guardando = false; this.guardado.emit(); },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.detail || 'No se pudo actualizar el usuario.';
      }
    });
  }
}
