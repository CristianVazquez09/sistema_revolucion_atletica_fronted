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
    telefono:        new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
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

  private normalizarTelefono(v: unknown): string {
    return String(v ?? '').replace(/\D/g, '').slice(0, 10);
  }

  ngOnInit(): void {
    if (this.socio) {
      // Igual que en PaqueteModal: rehacer el form con datos del backend
      this.socioService.buscarPorId(this.socio.idSocio).subscribe(s => {
        this.formulario = new FormGroup({
          idSocio:         new FormControl(s.idSocio),
          nombre:          new FormControl(s.nombre, [Validators.required, Validators.maxLength(100)]),
          apellido:        new FormControl(s.apellido, [Validators.required, Validators.maxLength(120)]),
          telefono:        new FormControl(this.normalizarTelefono(s.telefono as string), [Validators.required, Validators.pattern(/^[0-9]{10}$/)]),
          email:           new FormControl(s.email ?? '', [Validators.email, Validators.maxLength(120)]),
          direccion:       new FormControl(s.direccion ?? '', [Validators.maxLength(200)]),
          genero:          new FormControl(s.genero as any, [Validators.required]),
          fechaNacimiento: new FormControl(s.fechaNacimiento, [Validators.required]),
          comentarios:     new FormControl(s.comentarios ?? ''),
        });
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
        telefono: this.normalizarTelefono(f.telefono),
        email: f.email ?? '',
        direccion: f.direccion ?? '',
        genero: f.genero!,
        fechaNacimiento: f.fechaNacimiento!,
        comentarios: f.comentarios ?? ''
      };
      obs = this.socioService.actualizar(this.socio.idSocio, payloadUpdate);
    } else {
      // CREATE → cuerpo SIN id, casteado solo en la llamada (mismo patrón)
      const bodyCrearSinId = {
        nombre: f.nombre!,
        apellido: f.apellido!,
        telefono: this.normalizarTelefono(f.telefono),
        email: f.email ?? '',
        direccion: f.direccion ?? '',
        genero: f.genero!,
        fechaNacimiento: f.fechaNacimiento!,
        comentarios: f.comentarios ?? ''
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
