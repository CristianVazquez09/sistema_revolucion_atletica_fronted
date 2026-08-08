import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Output,
  input,
} from '@angular/core';

/** Cascarón compartido para modales: backdrop + panel + header (titulo +
 * cierre). El body se proyecta tal cual (sin padding propio, para no doblar
 * el padding que cada formulario consumidor ya trae). Cierra con click en el
 * backdrop (configurable) y con Escape (siempre, es una mejora nueva — casi
 * ningún modal existente lo tenía). */
@Component({
  selector: 'ra-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        (click)="onBackdropClick()"
      ></div>
      <div class="relative z-10 mx-4 w-full {{ anchoMax() }}">
        <div class="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div class="flex items-start justify-between px-6 pt-5">
            <div class="min-w-0">
              <h2 class="text-ra-slate text-[20px] leading-none font-bold">{{ titulo() }}</h2>
              <ng-content select="[ra-modal-subtitulo]"></ng-content>
            </div>
            <button
              type="button"
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700"
              (click)="cerrar.emit()"
              aria-label="Cerrar"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
})
export class RaModal {
  titulo = input('');
  /** Clase Tailwind de ancho máximo del panel (ej. 'max-w-xl', 'max-w-[720px]'). */
  anchoMax = input('max-w-2xl');
  cerrarAlClickFuera = input(true);

  @Output() cerrar = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrar.emit();
  }

  protected onBackdropClick(): void {
    if (this.cerrarAlClickFuera()) this.cerrar.emit();
  }
}
