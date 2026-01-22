import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
  catchError,
  filter,
  tap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NotificacionService } from 'src/app/services/notificacion-service';
import { AsesoriaNutricionalService } from 'src/app/services/asesoria-nutricional-service';
import { SocioService } from 'src/app/services/socio-service';

import { SocioData } from 'src/app/model/socio-data';
import { PagedResponse } from 'src/app/model/paged-response';

import {
  AsesoriaNutricionalData,
  AsesoriaNutricionalUpsertDTO,
} from 'src/app/model/asesoria-nutricional-data';

@Component({
  selector: 'app-asesoria-nutriocional-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './asesoria-nutriocional-modal.html',
  styleUrl: './asesoria-nutriocional-modal.css',
})
export class AsesoriaNutriocionalModal implements OnInit, OnDestroy {
  @Input() asesoria: AsesoriaNutricionalData | null = null;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  private noti = inject(NotificacionService);
  private srv = inject(AsesoriaNutricionalService);
  private socioSrv = inject(SocioService);

  guardando = false;
  error: string | null = null;
  intentoGuardar = false;

  // ✅ buscador typeahead
  busquedaCtrl = this.fb.nonNullable.control('');

  buscandoSocios = false;
  sociosEncontradosSig = signal<SocioData[]>([]);
  socioSeleccionadoSig = signal<SocioData | null>(null);

  intentoBusquedaSig = signal(false);

  // ✅ modo edición
  esEdicion = computed(() => this.getAsesoriaId() > 0);

  titulo = computed(() =>
    this.esEdicion() ? 'Renovar / Editar asesoría' : 'Agregar asesorado'
  );

  // ✅ formulario
  form = this.fb.group({
    idSocio: this.fb.control<number | null>(null, [Validators.required]),
    fechaInicio: this.fb.nonNullable.control('', [Validators.required]),
    fechaFin: this.fb.nonNullable.control('', [Validators.required]),
  });

  ngOnInit(): void {
    // ✅ precarga si edición
    if (this.asesoria?.socio?.idSocio) {
      const socio = this.asesoria.socio;
      this.socioSeleccionadoSig.set(socio);

      this.form.patchValue(
        {
          idSocio: socio.idSocio,
          fechaInicio: String(this.asesoria.fechaInicio ?? ''),
          fechaFin: String(this.asesoria.fechaFin ?? ''),
        },
        { emitEvent: false }
      );

      this.busquedaCtrl.setValue(this.labelSocio(socio), { emitEvent: false });

      // ✅ recomendado: no permitir cambiar socio en edición
      this.busquedaCtrl.disable({ emitEvent: false });
    }

    // ✅ Solo activar typeahead si NO es edición
    if (!this.esEdicion()) {
      this.busquedaCtrl.valueChanges
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          map((v) => this.normalizar(v)),
          tap((term) => {
            const sel = this.socioSeleccionadoSig();
            if (sel && term !== this.labelSocio(sel)) {
              this.socioSeleccionadoSig.set(null);
              this.form.controls.idSocio.setValue(null, { emitEvent: false });
            }

            if (!term) {
              this.sociosEncontradosSig.set([]);
              this.error = null;
              this.intentoBusquedaSig.set(false);
            }
          }),
          debounceTime(250),
          distinctUntilChanged(),
          filter((term) => term.length >= 2),
          tap(() => {
            this.buscandoSocios = true;
            this.error = null;
            this.intentoBusquedaSig.set(true);
          }),
          switchMap((term) =>
            this.socioSrv.buscarSociosPorNombre(term, 0, 10, null, null, null).pipe(
              map(
                (resp: PagedResponse<SocioData>) =>
                  (resp?.contenido ?? []) as SocioData[]
              ),
              catchError((err) => {
                console.error(err);
                this.error = 'No se pudieron buscar socios.';
                return of([] as SocioData[]);
              }),
              finalize(() => (this.buscandoSocios = false))
            )
          )
        )
        .subscribe((list) => {
          this.sociosEncontradosSig.set(list ?? []);
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

  private normalizar(v: string): string {
    return (v ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ✅ ID real de asesoría (backend manda idAsesoriaNutricional)
  private getAsesoriaId(): number {
    const a: any = this.asesoria as any;
    return Number(a?.idAsesoriaNutricional ?? a?.idAsesoria ?? a?.id ?? 0);
  }

  // ✅ Enter/Botón Buscar (solo si NO es edición)
  buscarAsesoradoNow(): void {
    if (this.esEdicion()) return;

    const term = this.normalizar(this.busquedaCtrl.value);
    if (!term) {
      this.sociosEncontradosSig.set([]);
      this.intentoBusquedaSig.set(false);
      return;
    }

    this.buscandoSocios = true;
    this.error = null;
    this.intentoBusquedaSig.set(true);

    this.socioSrv
      .buscarSociosPorNombre(term, 0, 10, null, null, null)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.buscandoSocios = false))
      )
      .subscribe({
        next: (resp: PagedResponse<SocioData>) =>
          this.sociosEncontradosSig.set(resp?.contenido ?? []),
        error: (err) => {
          console.error(err);
          this.error = 'No se pudieron buscar socios.';
          this.sociosEncontradosSig.set([]);
        },
      });
  }

  seleccionarSocio(s: SocioData): void {
    if (this.esEdicion()) return;

    this.socioSeleccionadoSig.set(s);
    this.form.controls.idSocio.setValue(s.idSocio, { emitEvent: false });

    this.busquedaCtrl.setValue(this.labelSocio(s), { emitEvent: false });
    this.sociosEncontradosSig.set([]);
  }

  limpiarSeleccion(): void {
    if (this.esEdicion()) return;

    this.socioSeleccionadoSig.set(null);
    this.form.controls.idSocio.setValue(null, { emitEvent: false });

    this.busquedaCtrl.setValue('', { emitEvent: false });
    this.sociosEncontradosSig.set([]);
    this.intentoBusquedaSig.set(false);
  }

  private labelSocio(s: SocioData): string {
    const n = (s?.nombre ?? '').trim();
    const a = (s?.apellido ?? '').trim();
    return `${n} ${a}`.trim();
  }

  gimnasioLabel(s: SocioData): string {
    const anyS: any = s as any;
    const g1 = String(anyS?.gimnasio?.nombre ?? '').trim();
    const g2 = String(anyS?.gimnasioNombre ?? '').trim();
    const g3 = String(anyS?.nombreGimnasio ?? '').trim();
    return g1 || g2 || g3 || '—';
  }

  private validarFechas(): boolean {
    const ini = this.form.controls.fechaInicio.value;
    const fin = this.form.controls.fechaFin.value;
    if (!ini || !fin) return false;

    const dIni = new Date(ini);
    dIni.setHours(0, 0, 0, 0);
    const dFin = new Date(fin);
    dFin.setHours(0, 0, 0, 0);

    if (dFin < dIni) {
      this.error = 'La fecha fin no puede ser anterior a la fecha inicio.';
      return false;
    }
    return true;
  }

  guardar(): void {
    this.intentoGuardar = true;
    this.error = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.validarFechas()) return;

    const f = this.form.getRawValue();

    const dto: AsesoriaNutricionalUpsertDTO = {
      idSocio: Number(f.idSocio),
      fechaInicio: String(f.fechaInicio),
      fechaFin: String(f.fechaFin),
    } as any;

    this.guardando = true;

    const idAsesoria = this.getAsesoriaId();

    const obs =
      idAsesoria > 0
        ? this.srv.renovar(idAsesoria, dto) // ✅ PUT /{id}
        : this.srv.crear(dto); // ✅ POST

    obs
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.guardando = false))
      )
      .subscribe({
        next: () => {
          this.noti.exito?.(
            idAsesoria > 0 ? 'Asesoría actualizada.' : 'Asesoría creada.'
          );
          this.guardado.emit();
        },
        error: (err) => {
          console.error(err);

          const status = err?.status;

          if (status === 409) {
            this.error =
              'El socio ya tiene una asesoría registrada. Usa Renovar / Editar.';
          } else if (status === 400) {
            this.error = err?.error?.message || 'Datos inválidos.';
          } else {
            this.error = 'No se pudo guardar la asesoría nutricional.';
          }

          // ✅ FIX TS: garantizar string
          const msg = this.error || 'No se pudo guardar la asesoría nutricional.';
          this.noti.error(msg);
        },
      });
  }
}
