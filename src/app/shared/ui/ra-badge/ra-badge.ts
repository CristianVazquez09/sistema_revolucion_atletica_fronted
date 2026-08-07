import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type RaBadgeVariante = 'exito' | 'neutral' | 'info' | 'advertencia' | 'peligro' | 'chip';

const CLASES_POR_VARIANTE: Record<RaBadgeVariante, string> = {
  exito: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-gray-100 text-gray-700',
  info: 'bg-indigo-100 text-indigo-700',
  advertencia: 'bg-amber-100 text-amber-800',
  peligro: 'bg-rose-100 text-rose-800',
  chip: 'bg-[color:var(--color-ra-azul-fuerte)]/10 text-[color:var(--color-ra-azul-fuerte)]',
};

/** Pill de estado o chip informativo. `chip` es para datos no-semánticos
 * (ej. nombre del gimnasio) — el resto son estados con significado. */
@Component({
  selector: 'ra-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="clases()"><ng-content></ng-content></span>`,
})
export class RaBadge {
  variante = input<RaBadgeVariante>('neutral');

  protected readonly clases = computed(
    () =>
      `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${CLASES_POR_VARIANTE[this.variante()]}`,
  );
}
