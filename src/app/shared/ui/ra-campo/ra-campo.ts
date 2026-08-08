import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Envoltura de label + control proyectado + mensaje de error. El
 * `<input>`/`<select>` real se proyecta como contenido — ra-campo NO
 * reemplaza el control ni interfiere con formControlName/ngModel. */
@Component({
  selector: 'ra-campo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (etiqueta()) {
        <label class="mb-1.5 block text-sm font-semibold text-ra-slate">
          {{ etiqueta() }}
          @if (requerido()) {
            <span class="text-red-600">*</span>
          }
        </label>
      }
      <ng-content></ng-content>
      @if (error()) {
        <p class="mt-1 text-sm text-red-600">{{ error() }}</p>
      }
    </div>
  `,
})
export class RaCampo {
  etiqueta = input('');
  requerido = input(false);
  error = input<string | null>(null);
}
