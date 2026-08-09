import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Cascarón de tabla: contenedor de scroll horizontal + `<table>` + manejo
 * de los 3 estados especiales (cargando/error/vacío) con el mismo hack de
 * `colspan="99"` que ya usan las 17 tablas reales (spanea cualquier cantidad
 * de columnas sin que cada consumidor tenga que contar las suyas).
 *
 * El `<thead>` se proyecta completo vía `[ra-tabla-head]` (las columnas son
 * 100% distintas por tabla). Las filas `<tr>` reales se proyectan como
 * contenido por defecto, SOLO se muestran cuando no aplica ningún estado
 * especial — `ra-tabla` no sabe nada de qué hay adentro de cada fila.
 *
 * `<colgroup>` (si la tabla define anchos de columna fijos) se proyecta con
 * su PROPIO slot `[ra-tabla-colgroup]`, colocado como hijo directo de
 * `<table>` ANTES del `<thead>` — igual que exige la especificación CSS de
 * tablas. Si `<colgroup>` quedara anidado dentro del `<thead>` proyectado
 * (en vez de ser hermano directo bajo `<table>`), el navegador lo trata como
 * mal ubicado y genera una tabla anónima alrededor: los anchos de columna
 * dejan de aplicar, sin ningún error visible — por eso el slot separado. */
@Component({
  selector: 'ra-tabla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full table-fixed border-collapse text-xs {{ ancho() }}">
        <ng-content select="[ra-tabla-colgroup]"></ng-content>
        <ng-content select="[ra-tabla-head]"></ng-content>
        <tbody>
          @if (cargando()) {
            <tr>
              <td [attr.colspan]="99" class="text-ra-slate py-10 text-center">
                {{ mensajeCargando() }}
              </td>
            </tr>
          } @else if (error()) {
            <tr>
              <td [attr.colspan]="99" class="py-10 text-center text-red-600">{{ error() }}</td>
            </tr>
          } @else if (vacio()) {
            <tr>
              <td [attr.colspan]="99" class="text-ra-slate py-10 text-center">
                {{ mensajeVacio() }}
              </td>
            </tr>
          } @else {
            <ng-content></ng-content>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class RaTabla {
  /** Clase de ancho mínimo, ej. 'min-w-[700px]' — varía por tabla según su
   * cantidad de columnas. Sin default sensato único; cada consumidor la pasa. */
  ancho = input('');
  cargando = input(false);
  error = input<string | null>(null);
  /** El consumidor calcula esto (ej. `[vacio]="listaSocios.length === 0"`) —
   * `ra-tabla` no puede saberlo por sí sola porque las filas son contenido
   * proyectado, no datos que el componente reciba. */
  vacio = input(false);
  mensajeCargando = input('Cargando…');
  mensajeVacio = input('Sin resultados.');
}
