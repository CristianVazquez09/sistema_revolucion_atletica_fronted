// src/app/pages/corte-caja-info/corte-caja-info.ts
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize, forkJoin } from 'rxjs';
import { CorteCajaListado } from 'src/app/model/corte-caja-data';
import { CorteCajaService } from 'src/app/services/corte-caja-service';
;

@Component({
  selector: 'app-corte-caja-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './corte-caja-info.html',
  styleUrl: './corte-caja-info.css'
})
export class CorteCajaInfo implements OnInit, OnDestroy {

  @Input({ required: true }) corte!: CorteCajaListado;
  @Output() cerrar = new EventEmitter<void>();

  private srv = inject(CorteCajaService);

  detalle: any = null;     // CorteCajaResponseDTO
  salidas: any[] = [];     // SalidaEfectivoDTO[]
  cargando = false;
  error: string | null = null;

  ngOnInit(): void {
    if (!this.corte?.idCorte) {
      this.error = 'Corte inválido.';
      return;
    }

    this.cargando = true;
    this.error = null;

    const id = this.corte.idCorte;

    forkJoin({
      detalle: this.srv.consultar(id),
      salidas: this.srv.listarSalidas(id)
    })
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: ({ detalle, salidas }) => {
          this.detalle = detalle;
          this.salidas = salidas ?? [];
        },
        error: (err) => {
          console.error('[CorteCajaInfo] error cargando detalle', err);
          this.error = 'No se pudo cargar la información del corte.';
        },
      });

    window.addEventListener('keydown', this.handleEsc);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.handleEsc);
  }

  private handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.cerrar.emit();
    }
  };

  cerrarModal(): void {
    this.cerrar.emit();
  }

  totalSalidasLocal(): number {
    return (this.salidas ?? []).reduce(
      (acc, s) => acc + (Number(s?.monto ?? 0) || 0),
      0
    );
  }

  esCerrado(): boolean {
    return this.detalle?.estado === 'CERRADO';
  }
}
