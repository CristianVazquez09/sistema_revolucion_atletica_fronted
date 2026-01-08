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

const MULTI_WS = /\s+/g;

function normalizeText(v: unknown): string {
  if (v == null) return '';
  return String(v)
    .replace(/\uFEFF/g, '')   // BOM
    .replace(/\u00A0/g, ' ')  // NBSP -> espacio normal
    .replace(MULTI_WS, ' ')
    .trim();
}

function normalizeEmail(v: unknown): string {
  const t = normalizeText(v);
  return t ? t.toLowerCase() : '';
}

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
  private gymSrv = inject(GimnasioService);
  private jwt = inject(JwtHelperService);

  isAdmin = false;
  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;

  formulario: FormGroup = new FormGroup({
    idSocio: new FormControl(0),

    nombre: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    apellido: new FormControl('', [Validators.required, Validators.maxLength(120)]),

    telefono: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
    email: new FormControl('', [Validators.email, Validators.maxLength(120)]),
    direccion: new FormControl('', [Validators.maxLength(200)]),

    genero: new FormControl(null as 'MASCULINO' | 'FEMENINO' | 'OTRO' | null, [Validators.required]),
    fechaNacimiento: new FormControl(null as string | null, [Validators.required]),
    comentarios: new FormControl(''),

    gimnasioId: new FormControl<number | null>({ value: null, disabled: true })
  });

  titulo = computed(() => this.socio ? 'Editar socio' : 'Agregar socio');

  guardando = false;
  error: string | null = null;

  // Huella
  mostrarModalHuella = signal(false);
  huellaProceso = signal(false);
  huellaMensaje = signal<string | null>(null);
  huellaError = signal<string | null>(null);
  huellaDigitalBase64: string | null = null;

  ngOnInit(): void {
    this.isAdmin = this.deducirEsAdminDesdeToken();

    if (this.isAdmin) {
      const gymCtrl = this.formulario.controls['gimnasioId'];
      gymCtrl.addValidators([Validators.required]);

      this.cargandoGimnasios = true;
      this.gymSrv.buscarTodos().subscribe({
        next: (lista) => {
          this.gimnasios = (lista ?? []).map(g => ({
            idGimnasio: (g as any).idGimnasio ?? (g as any).id,
            nombre: g.nombre,
            direccion: g.direccion,
            telefono: g.telefono
          }));

          const idPre =
            (this.socio?.gimnasio as any)?.idGimnasio ??
            (this.socio?.gimnasio as any)?.id ??
            this.gimnasios[0]?.idGimnasio ??
            null;

          if (idPre != null) {
            gymCtrl.setValue(Number(idPre), { emitEvent: false });
          }

          gymCtrl.enable({ emitEvent: false });
          this.cargandoGimnasios = false;
        },
        error: () => {
          this.cargandoGimnasios = false;
        }
      });
    }

    if (this.socio) {
      this.socioService.buscarPorId(this.socio.idSocio).subscribe(s => {
        this.formulario.patchValue({
          idSocio: s.idSocio,
          nombre: normalizeText(s.nombre),
          apellido: normalizeText(s.apellido),
          telefono: this.normalizarTelefono(s.telefono),
          email: normalizeEmail(s.email),
          direccion: normalizeText(s.direccion),
          genero: s.genero ?? null,
          fechaNacimiento: s.fechaNacimiento ?? null,
          comentarios: normalizeText(s.comentarios)
        });

        if (this.isAdmin) {
          const gymCtrl = this.formulario.controls['gimnasioId'];
          const gymId = (s.gimnasio as any)?.idGimnasio ?? (s.gimnasio as any)?.id ?? null;
          if (gymId != null) gymCtrl.setValue(Number(gymId), { emitEvent: false });
        }

        // deja todo ya “limpio” por si el backend venía con espacios
        this.normalizarCamposTextoAntesDeValidar();
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

  // -------------------------
  // Normalización (Front)
  // -------------------------

  normalizarCamposTextoAntesDeValidar(): void {
    const nombreCtrl = this.formulario.controls['nombre'];
    const apellidoCtrl = this.formulario.controls['apellido'];
    const emailCtrl = this.formulario.controls['email'];
    const direccionCtrl = this.formulario.controls['direccion'];
    const comentariosCtrl = this.formulario.controls['comentarios'];

    nombreCtrl.setValue(normalizeText(nombreCtrl.value), { emitEvent: false });
    apellidoCtrl.setValue(normalizeText(apellidoCtrl.value), { emitEvent: false });
    emailCtrl.setValue(normalizeEmail(emailCtrl.value), { emitEvent: false });

    direccionCtrl.setValue(normalizeText(direccionCtrl.value), { emitEvent: false });
    comentariosCtrl.setValue(normalizeText(comentariosCtrl.value), { emitEvent: false });

    nombreCtrl.updateValueAndValidity({ emitEvent: false });
    apellidoCtrl.updateValueAndValidity({ emitEvent: false });
    emailCtrl.updateValueAndValidity({ emitEvent: false });
  }

  // -------------------------
  // Huella
  // -------------------------

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
      this.huellaMensaje.set('Huella capturada. Se guardará al crear el socio.');
    }
  }

  private elegirMejorIndice(calidades: number[], total: number): number {
    if (!Array.isArray(calidades) || calidades.length !== total || total === 0) return 0;

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

  // -------------------------
  // Guardar
  // -------------------------

  guardar(): void {
    // Limpia espacios invisibles / finales antes de validar/persistir
    this.normalizarCamposTextoAntesDeValidar();

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.error = null;
    this.guardando = true;

    const f = this.formulario.getRawValue();

    // conservar activo en edición; nuevo => true
    const activo = this.socio ? (this.socio.activo !== false) : true;

    // gimnasio (admin: select; no admin: conservar el existente)
    let gymObj: { id: number } | undefined;

    if (this.isAdmin) {
      const gymId = this.formulario.controls['gimnasioId'].value;
      if (gymId != null) gymObj = { id: Number(gymId) };
    } else if (this.socio?.gimnasio) {
      const gid = (this.socio.gimnasio as any).id ?? (this.socio.gimnasio as any).idGimnasio;
      if (gid != null) gymObj = { id: Number(gid) };
    }

    const basePayload: SocioData = {
      idSocio: this.socio?.idSocio ?? 0,
      nombre: normalizeText(f.nombre),
      apellido: normalizeText(f.apellido),
      telefono: this.normalizarTelefono(f.telefono),
      email: normalizeEmail(f.email),
      direccion: normalizeText(f.direccion),
      genero: f.genero!,
      fechaNacimiento: f.fechaNacimiento!,
      comentarios: normalizeText(f.comentarios),
      activo
    } as SocioData;

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
