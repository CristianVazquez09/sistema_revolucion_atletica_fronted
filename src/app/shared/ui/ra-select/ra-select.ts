import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface RaSelectOpcion<T> {
  valor: T;
  etiqueta: string;
}

/** Dropdown con estilo propio que reemplaza al `<select>` nativo (popup
 * controlado por el SO, no estilizable). Visualmente alineado con el panel
 * de los combobox de búsqueda ya existentes en la app (`rounded-xl2`,
 * blanco, filas con hover) — mismas clases, reutilizadas a propósito.
 *
 * Implementa `ControlValueAccessor` para poder usarse igual que un `<select>`
 * nativo en cualquiera de los 3 patrones de binding presentes en la app:
 * reactive forms (`formControlName`), `[(ngModel)]`, o `[ngModel]` +
 * `(ngModelChange)` separados. No emite ningún `@Output` propio: el cambio
 * de valor viaja exclusivamente por `registerOnChange`.
 *
 * `deshabilitado()` puede activarse por 2 vías independientes que se
 * combinan con OR: el input explícito `deshabilitado` (binding directo,
 * fuera de cualquier `FormControl`) y `setDisabledState` (vía CVA, cuando el
 * consumidor deshabilita un `FormGroup`/`FormControl`). Cualquiera de las
 * dos alcanza para bloquear el control. */
@Component({
  selector: 'ra-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RaSelect),
      multi: true,
    },
  ],
  template: `
    <div class="relative">
      <button
        type="button"
        class="input-filled flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
        [disabled]="estaDeshabilitado()"
        (click)="alternar()"
        [attr.aria-expanded]="abierto()"
        role="combobox"
        aria-haspopup="listbox"
      >
        <span class="truncate" [class.text-gray-400]="!etiquetaActual()">
          {{ etiquetaActual() || placeholder() }}
        </span>
        <svg class="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      @if (abierto()) {
        <div class="rounded-xl2 shadow-card absolute z-50 mt-1 w-full overflow-hidden border border-gray-200 bg-white" role="listbox">
          <div class="max-h-[280px] overflow-auto">
            @for (op of opciones(); track op.valor; let i = $index) {
              <button
                type="button"
                role="option"
                class="w-full border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
                [class.bg-gray-50]="i === resaltado()"
                [attr.aria-selected]="op.valor === valorActual()"
                (click)="seleccionar(op)"
                (mouseenter)="resaltado.set(i)"
              >
                {{ op.etiqueta }}
              </button>
            }
            @if (!opciones().length) {
              <div class="text-ra-slate/70 px-3 py-2 text-sm">Sin opciones.</div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class RaSelect<T> implements ControlValueAccessor {
  /** Lista de opciones, SIN opción-placeholder incluida (a diferencia del
   * `<select>` nativo que hoy reemplaza, donde el placeholder vivía como una
   * `<option disabled>` dentro de la lista). El placeholder es el input de
   * abajo. */
  opciones = input<RaSelectOpcion<T>[]>([]);
  placeholder = input('Selecciona…');
  /** Deshabilitado explícito, independiente del CVA (ej. `[deshabilitado]="cargando()"`
   * en un filtro de página sin `FormControl`). Se combina por OR con el
   * deshabilitado que llega vía `setDisabledState`. */
  deshabilitado = input(false);

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly valorActual = signal<T | null>(null);
  protected readonly abierto = signal(false);
  protected readonly resaltado = signal(-1);
  private readonly deshabilitadoPorForm = signal(false);

  protected readonly estaDeshabilitado = computed(() => this.deshabilitado() || this.deshabilitadoPorForm());
  protected readonly etiquetaActual = computed(
    () => this.opciones().find((op) => op.valor === this.valorActual())?.etiqueta ?? null,
  );

  private onChange: (v: T | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: T | null): void {
    this.valorActual.set(v);
  }

  registerOnChange(fn: (v: T | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.deshabilitadoPorForm.set(isDisabled);
  }

  protected alternar(): void {
    if (this.estaDeshabilitado()) return;
    if (this.abierto()) this.cerrar();
    else this.abrir();
  }

  protected seleccionar(op: RaSelectOpcion<T>): void {
    this.valorActual.set(op.valor);
    this.onChange(op.valor);
    this.onTouched();
    this.cerrar();
  }

  private abrir(): void {
    // Al abrir, resalta la opción actualmente seleccionada (si existe);
    // si no hay valor o no matchea ninguna opción, arranca sin resaltar (-1).
    this.resaltado.set(this.opciones().findIndex((op) => op.valor === this.valorActual()));
    this.abierto.set(true);
  }

  private cerrar(): void {
    this.abierto.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.elementRef.nativeElement.contains(event.target as Node)) return;
    if (!this.abierto()) return;
    this.cerrar();
    this.onTouched();
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.estaDeshabilitado()) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.abierto()) {
          const op = this.opciones()[this.resaltado()];
          if (op) this.seleccionar(op);
        } else {
          this.abrir();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!this.abierto()) this.abrir();
        this.resaltado.update((i) => Math.min(i + 1, this.opciones().length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.abierto()) this.abrir();
        this.resaltado.update((i) => Math.max(i - 1, 0));
        break;
      case 'Escape':
        if (this.abierto()) {
          event.preventDefault();
          this.cerrar();
        }
        break;
    }
  }
}
