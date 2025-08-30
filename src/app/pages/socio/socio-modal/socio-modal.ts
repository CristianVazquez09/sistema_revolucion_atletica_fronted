import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { SocioData } from '../../../model/socio-data';
import { SocioService } from '../../../services/socio-service';

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

  // Formulario (mismo estilo que PaqueteModal)
  formulario: FormGroup = new FormGroup({
    idSocio:         new FormControl(0),
    nombre:          new FormControl('', [Validators.required, Validators.maxLength(100)]),
    apellido:        new FormControl('', [Validators.required, Validators.maxLength(120)]),
    telefono:        new FormControl('', [Validators.required, Validators.pattern(/^\d{10}$/)]),
    email:           new FormControl('', [Validators.email, Validators.maxLength(120)]),
    direccion:       new FormControl('', [Validators.maxLength(200)]),
    genero:          new FormControl(null as 'MASCULINO' | 'FEMENINO' | 'OTRO' | null, [Validators.required]),
    fechaNacimiento: new FormControl(null as string | null, [Validators.required]), // ISO 'YYYY-MM-DD'
    comentarios:     new FormControl(''),
  });

  // UI
  titulo = computed(() => this.socio ? 'Editar socio' : 'Agregar socio');
  guardando = false;
  error: string | null = null;

  constructor(private socioService: SocioService) {}

  ngOnInit(): void {
    if (this.socio) {
      // Cargamos del backend, pero sin reemplazar el FormGroup para no romper bindings
      this.socioService.buscarPorId(this.socio.idSocio).subscribe({
        next: (s) => {
          const data = s ?? this.socio!;
          this.formulario.patchValue({
            idSocio: data.idSocio,
            nombre: data.nombre ?? '',
            apellido: data.apellido ?? '',
            telefono: data.telefono ?? '',
            email: data.email ?? '',
            direccion: data.direccion ?? '',
            genero: (data.genero as any) ?? null,
            fechaNacimiento: data.fechaNacimiento ?? null,
            comentarios: data.comentarios ?? ''
          });
        },
        error: () => {
          // Como fallback, usamos el input directo
          const s = this.socio!;
          this.formulario.patchValue({
            idSocio: s.idSocio,
            nombre: s.nombre ?? '',
            apellido: s.apellido ?? '',
            telefono: s.telefono ?? '',
            email: s.email ?? '',
            direccion: s.direccion ?? '',
            genero: (s.genero as any) ?? null,
            fechaNacimiento: s.fechaNacimiento ?? null,
            comentarios: s.comentarios ?? ''
          });
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

  guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.error = null;
    this.guardando = true;

    const f = this.formulario.getRawValue();
    let obs;

    if (this.socio) {
      // UPDATE → payload completo con id (mismo patrón que PaqueteModal)
      const payloadUpdate: SocioData = {
        idSocio: this.socio.idSocio,
        nombre: f.nombre!,
        apellido: f.apellido!,
        telefono: f.telefono!,
        email: f.email ?? '',
        direccion: f.direccion ?? '',
        genero: f.genero!,
        fechaNacimiento: f.fechaNacimiento!,
        comentarios: f.comentarios ?? '',
        activo: this.socio.activo ?? true
      };
      obs = this.socioService.actualizar(this.socio.idSocio, payloadUpdate);
    } else {
      // CREATE → cuerpo SIN id, casteado solo en la llamada (mismo patrón)
      const bodyCrearSinId = {
        nombre: f.nombre!,
        apellido: f.apellido!,
        telefono: f.telefono!,
        email: f.email ?? '',
        direccion: f.direccion ?? '',
        genero: f.genero!,
        fechaNacimiento: f.fechaNacimiento!,
        comentarios: f.comentarios ?? '',
        activo: true
      } as unknown as SocioData;

      obs = this.socioService.guardar(bodyCrearSinId);
    }

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
