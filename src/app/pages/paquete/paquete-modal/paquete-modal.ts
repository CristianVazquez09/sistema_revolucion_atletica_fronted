import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { PaqueteData } from '../../../model/paquete-data';
import { TiempoPlan } from '../../../util/enums/tiempo-plan';
import { TiempoPlanLabelPipe } from '../../../util/tiempo-plan-label';
import { PaqueteService } from '../../../services/paquete-service';
import { GimnasioService } from '../../../services/gimnasio-service';
import { GimnasioData } from '../../../model/gimnasio-data';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../../environments/environment';
import { TipoPaquete } from '../../../util/enums/tipo-paquete';

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

  // Enum -> opciones de tiempo
  tiempos = (Object.values(TiempoPlan).filter(v => typeof v === 'string') as string[]) as unknown as TiempoPlan[];

  // Opciones de tipo de paquete
  TipoPaquete = TipoPaquete;
  tiposPaquete: TipoPaquete[] = Object.values(TipoPaquete);

  titulo = computed(() => this.paquete ? 'Editar paquete' : 'Agregar paquete');

  fb: FormGroup = new FormGroup({
    idPaquete:         new FormControl(0),
    nombre:            new FormControl('', [Validators.required, Validators.maxLength(100)]),
    tiempo:            new FormControl<TiempoPlan | null>(null, [Validators.required]),
    precio:            new FormControl(0, [Validators.required, Validators.min(0)]),
    costoInscripcion:  new FormControl(0, [Validators.required, Validators.min(0)]),
    gimnasioId:        new FormControl<number | null>(null),

    // Para planes por visitas
    visitasMaximas:    new FormControl<number | null>(null),

    // Solo fines de semana
    soloFinesDeSemana: new FormControl<boolean>(false),

    // NUEVO: tipo de paquete
    tipoPaquete:       new FormControl<TipoPaquete | null>(TipoPaquete.GIMNASIO, [Validators.required]),
  });

  // Bandera reactiva
  isPlanPorVisitas = computed(() => {
    const t = this.fb.controls['tiempo'].value as TiempoPlan | null;
    return t === TiempoPlan.VISITA_10 || t === TiempoPlan.VISITA_15;
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

    // Reglas dinámicas para visitasMaximas
    this.fb.controls['tiempo'].valueChanges.subscribe((t: TiempoPlan | null) => {
      const ctrl = this.fb.controls['visitasMaximas'];
      if (t === TiempoPlan.VISITA_10 || t === TiempoPlan.VISITA_15) {
        ctrl.addValidators([Validators.required, Validators.min(0), Validators.max(999999)]);
        if (!this.paquete) {
          ctrl.setValue(t === TiempoPlan.VISITA_10 ? 10 : 15, { emitEvent: false });
        }
      } else {
        ctrl.clearValidators();
        ctrl.setValue(null, { emitEvent: false });
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    window.addEventListener('keydown', this.handleEsc);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleEsc);
  }

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

    this.fb.patchValue({
      idPaquete:        this.paquete.idPaquete,
      nombre:           this.paquete.nombre,
      tiempo:           this.paquete.tiempo,
      precio:           this.paquete.precio,
      costoInscripcion: this.paquete.costoInscripcion,
      visitasMaximas:   this.paquete.visitasMaximas ?? null,
      soloFinesDeSemana: !!this.paquete.soloFinesDeSemana,
      tipoPaquete:      this.paquete.tipoPaquete ?? TipoPaquete.GIMNASIO,
    });

    if (this.isAdmin) {
      const anyG = this.paquete.gimnasio as any;
      const gymId = (typeof anyG?.idGimnasio === 'number' ? anyG.idGimnasio :
                    (typeof anyG?.id === 'number' ? anyG.id : null));
      if (gymId != null) {
        this.fb.controls['gimnasioId'].setValue(gymId);
      }
    }
  }

  labelTipoPaquete(tipo: TipoPaquete): string {
    switch (tipo) {
      case TipoPaquete.ZONA_COMBATE:
        return 'Zona de combate';
      case TipoPaquete.MIXTO:
        return 'Mixto (Gimnasio + Zona)';
      case TipoPaquete.GIMNASIO:
      default:
        return 'Gimnasio';
    }
  }

  guardar(): void {
    this.intentoGuardar = true;
    if (this.fb.invalid) { this.fb.markAllAsTouched(); return; }

    this.error = null;
    this.guardando = true;

    const f: any = this.fb.getRawValue();
    const esVisitas = f.tiempo === TiempoPlan.VISITA_10 || f.tiempo === TiempoPlan.VISITA_15;

    const base: any = {
      nombre: f.nombre,
      tiempo: f.tiempo,
      precio: Number(f.precio),
      costoInscripcion: Number(f.costoInscripcion),
      activo: true,

      // visitas (solo si aplica)
      visitasMaximas: esVisitas ? Number(f.visitasMaximas) : null,

      // fines de semana
      soloFinesDeSemana: !!f.soloFinesDeSemana,

      // tipo de paquete
      tipoPaquete: f.tipoPaquete ?? TipoPaquete.GIMNASIO,
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
      next: () => { this.guardando = false; this.guardado.emit(); },
      error: (err) => { console.error(err); this.guardando = false; this.error = 'No se pudo guardar el paquete.'; }
    });
  }

}
