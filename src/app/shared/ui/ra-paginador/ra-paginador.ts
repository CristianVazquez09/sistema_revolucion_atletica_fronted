import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RaSelect, RaSelectOpcion } from 'src/app/shared/ui/ra-select/ra-select';

/** Controles de paginación (info de página + selector de tamaño + Anterior/
 * Siguiente). Deliberadamente NO recibe un `PagedResponse`/`PageMeta` crudo
 * — la app tiene 2 formas de objeto de página incompatibles conviviendo hoy
 * (una en español vía `InfoPagina`, otra local en inglés estilo Spring), así
 * que este componente solo pide los valores primitivos ya normalizados por
 * cada consumidor, y emite un índice de página objetivo 0-based — el
 * consumidor decide cómo traducirlo a su propia convención interna. */
@Component({
  selector: 'ra-paginador',
  standalone: true,
  imports: [FormsModule, RaSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs"
    >
      <div class="text-ra-slate/70 flex shrink-0 items-center gap-2">
        <span>
          Página <strong class="text-ra-slate">{{ paginaActual() + 1 }}</strong> de
          <strong class="text-ra-slate">{{ totalPaginas() }}</strong>
        </span>
        <span class="text-ra-slate/50">({{ totalElementos() }} registros)</span>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto">
        <span class="text-ra-slate/60 shrink-0 whitespace-nowrap">Por página</span>
        <div class="w-[70px] shrink-0">
          <ra-select
            tamano="compacto"
            [opciones]="opcionesTamanio()"
            [ngModel]="tamanioPagina()"
            (ngModelChange)="cambiarTamanio.emit($event)"
          ></ra-select>
        </div>

        <div class="h-4 w-px shrink-0 bg-gray-200"></div>

        <button
          class="h-8 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs hover:bg-gray-50 disabled:opacity-40"
          [disabled]="paginaActual() === 0"
          (click)="irAPagina.emit(paginaActual() - 1)"
        >
          Anterior
        </button>
        <button
          class="h-8 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs hover:bg-gray-50 disabled:opacity-40"
          [disabled]="paginaActual() + 1 >= totalPaginas()"
          (click)="irAPagina.emit(paginaActual() + 1)"
        >
          Siguiente
        </button>
      </div>
    </div>
  `,
})
export class RaPaginador {
  /** 0-based, igual que `InfoPagina.numero`. */
  paginaActual = input.required<number>();
  totalPaginas = input.required<number>();
  totalElementos = input.required<number>();
  tamanioPagina = input.required<number>();
  tamaniosDisponibles = input<number[]>([10, 25, 50]);

  protected readonly opcionesTamanio = computed<RaSelectOpcion<number>[]>(() =>
    this.tamaniosDisponibles().map((t) => ({ valor: t, etiqueta: String(t) })),
  );

  /** Emite el índice de página OBJETIVO, 0-based. */
  @Output() irAPagina = new EventEmitter<number>();
  @Output() cambiarTamanio = new EventEmitter<number>();
}
