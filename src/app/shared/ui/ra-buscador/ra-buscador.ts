import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Output,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounce, distinctUntilChanged, map, timer } from 'rxjs';

/** Input de búsqueda con debounce centralizado. Emite el término ya
 * recortado (trim) y solo cuando cambia (distinctUntilChanged).
 *
 * `valor` es opcional: permite que el padre sincronice/limpie el texto
 * mostrado desde afuera (ej. un botón "Limpiar filtros" propio de la
 * página, o restaurar un borrador). Sin `valor`, ra-buscador se comporta
 * como no-controlado (el padre solo escucha `(buscar)`). */
@Component({
  selector: 'ra-buscador',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex shrink-0 items-center gap-1.5">
      <input
        type="text"
        [class]="clasesInput()"
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
  /** Texto externo opcional para sincronizar/limpiar el input desde el padre. */
  valor = input<string | null>(null);
  /** Clase Tailwind de ancho del input. Default fijo (240px) para las
   * barras de búsqueda de listas; usar 'w-full' cuando ra-buscador va
   * dentro de un contenedor que ya define su propio ancho máximo. */
  ancho = input('w-[240px]');

  @Output() buscar = new EventEmitter<string>();

  protected readonly terminoActual = signal('');
  protected readonly clasesInput = computed(
    () => `h-8 ${this.ancho()} rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs shadow-inner`,
  );

  private readonly destroyRef = inject(DestroyRef);
  private readonly entrada$ = new Subject<string>();

  constructor() {
    // Sincroniza el texto mostrado cuando el padre controla `valor`
    // (ej. limpiar filtros, restaurar un borrador). Si `valor` no se
    // provee (queda en null), este efecto no hace nada.
    effect(() => {
      const externo = this.valor();
      if (externo === null) return;
      this.terminoActual.set(externo);
    });

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
