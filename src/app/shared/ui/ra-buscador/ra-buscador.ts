import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Output,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounce, distinctUntilChanged, map, timer } from 'rxjs';

/** Input de búsqueda con debounce centralizado. Emite el término ya
 * recortado (trim) y solo cuando cambia (distinctUntilChanged). */
@Component({
  selector: 'ra-buscador',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex shrink-0 items-center gap-1.5">
      <input
        type="text"
        class="h-8 w-[240px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs shadow-inner"
        [placeholder]="placeholder()"
        [value]="terminoActual()"
        (input)="onInput($any($event.target).value)"
      />
      @if (terminoActual() && mostrarLimpiar()) {
        <button
          type="button"
          class="h-8 shrink-0 rounded-lg border border-gray-200 px-3 text-xs text-ra-slate hover:bg-gray-50"
          (click)="limpiar()"
        >
          Limpiar
        </button>
      }
    </div>
  `,
})
export class RaBuscador {
  placeholder = input('Buscar…');
  debounceMs = input(300);
  mostrarLimpiar = input(true);

  @Output() buscar = new EventEmitter<string>();

  protected readonly terminoActual = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly entrada$ = new Subject<string>();

  constructor() {
    this.entrada$
      .pipe(
        map((v) => v.trim()),
        // debounce (no debounceTime) porque debounceMs() es un signal input:
        // en el constructor todavía no tiene su valor ligado por template
        // (los inputs de señal se aplican después de construir la instancia,
        // igual que los @Input() clásicos). debounceTime(ms) evaluaría
        // this.debounceMs() una sola vez aquí y quedaría fijo en el default
        // (300) para siempre. debounce(() => timer(ms)) relee la señal en
        // cada emisión, cuando ya tiene el valor real ligado por el consumidor.
        debounce(() => timer(this.debounceMs())),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((termino) => this.buscar.emit(termino));
  }

  protected onInput(valor: string): void {
    this.terminoActual.set(valor);
    this.entrada$.next(valor);
  }

  protected limpiar(): void {
    this.terminoActual.set('');
    this.entrada$.next('');
  }
}
