import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgStyle } from '@angular/common';
import { RaDropdownRegistry } from './ra-dropdown-registry';

/** Menú de acciones por fila con posicionamiento anti-clipping (evita que se
 * corte contra el borde de la ventana). Proyecta los botones de acción como
 * contenido; solo uno puede estar abierto a la vez en toda la app. */
@Component({
  selector: 'ra-dropdown',
  standalone: true,
  imports: [NgStyle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #trigger
      type="button"
      class="mx-auto grid h-6 w-6 place-items-center rounded hover:bg-ra-grayLight/50"
      [attr.title]="tituloBoton()"
      (click)="alternar($event)"
    >
      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-[color:var(--color-ra-azul-fuerte)]" fill="currentColor">
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    </button>
    @if (abierto()) {
      <div
        class="fixed z-50 w-48 rounded-xl bg-white py-1 text-left shadow-lg ring-1 ring-black/10"
        [ngStyle]="posicion()"
        (click)="registry.cerrarTodos()"
      >
        <ng-content></ng-content>
      </div>
    }
  `,
})
export class RaDropdown {
  tituloBoton = input('Acciones');
  /** Alto estimado del panel en px, usado para decidir si abre hacia arriba
   * o abajo cerca del borde de la pantalla. Default 130 (2-3 ítems); pasar un
   * valor mayor si el menú tiene más ítems (ej. 220 para 4 ítems). */
  alturaMenu = input(130);

  @ViewChild('trigger', { static: true }) private triggerRef!: ElementRef<HTMLButtonElement>;

  protected readonly registry = inject(RaDropdownRegistry);
  private readonly id = Symbol('ra-dropdown');
  private readonly gap = 4;

  protected readonly abierto = computed(() => this.registry.estaAbierto(this.id));
  protected readonly posicion = signal<{ top?: string; bottom?: string; right: string }>({
    right: '0px',
  });

  protected alternar(event: MouseEvent): void {
    event.stopPropagation();
    if (this.abierto()) {
      this.registry.cerrarTodos();
      return;
    }
    const rect = this.triggerRef.nativeElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const spaceBelow = viewportHeight - rect.bottom;
    const openUp = spaceBelow < this.alturaMenu() + this.gap;
    this.posicion.set(
      openUp
        ? { bottom: `${viewportHeight - rect.top + this.gap}px`, right: `${window.innerWidth - rect.right}px` }
        : { top: `${rect.bottom + this.gap}px`, right: `${window.innerWidth - rect.right}px` },
    );
    this.registry.abrir(this.id);
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.abierto()) this.registry.cerrarTodos();
  }
}
