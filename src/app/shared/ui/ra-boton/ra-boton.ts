import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type RaBotonVariante = 'primario' | 'peligro' | 'exito' | 'info' | 'ghost' | 'icono-peligro';
export type RaBotonTamano = 'normal' | 'grande';

const CLASES_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-60 disabled:cursor-not-allowed';

// primario y peligro comparten rojo hoy (ambigüedad heredada, documentada
// desde Fase 4a — no se resuelve aquí).
const CLASES_POR_VARIANTE: Record<RaBotonVariante, string> = {
  primario: 'bg-red-600 hover:bg-red-700 text-white',
  peligro: 'bg-red-600 hover:bg-red-700 text-white',
  exito: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  info: 'bg-[color:var(--color-ra-azul-fuerte)] hover:bg-[#0A2540] text-white',
  ghost: 'bg-white border border-gray-200 hover:bg-gray-100 text-ra-slate',
  'icono-peligro': 'rounded-full bg-red-600 hover:bg-red-700 text-white grid place-items-center',
};

const CLASES_POR_TAMANO: Record<RaBotonTamano, string> = {
  normal: 'h-8 px-3 text-xs',
  grande: 'px-6 py-2.5 text-sm',
};

/** Botón con variantes semánticas. El click burbujea al host de forma nativa
 * — usar `<ra-boton (click)="accion()">` directamente. */
@Component({
  selector: 'ra-boton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button [type]="tipo()" [disabled]="deshabilitado()" [class]="clases()">
      <ng-content></ng-content>
    </button>
  `,
})
export class RaBoton {
  variante = input<RaBotonVariante>('primario');
  tamano = input<RaBotonTamano>('normal');
  tipo = input<'button' | 'submit'>('button');
  deshabilitado = input(false);

  protected readonly clases = computed(() => {
    const tamanoClases = this.variante() === 'icono-peligro' ? 'w-8 h-8' : CLASES_POR_TAMANO[this.tamano()];
    return `${CLASES_BASE} ${tamanoClases} ${CLASES_POR_VARIANTE[this.variante()]}`;
  });
}
