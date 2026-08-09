# Fase 4d — `ra-select`: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Goal:** Construir `ra-select` — un dropdown con estilo propio que reemplaza el `<select>` nativo (popup controlado por el SO, no estilizable), visualmente alineado con el panel del combobox de búsqueda ya existente en la app (`rounded-xl2`, blanco, filas con hover). Adoptarlo en 2 páginas representativas que validan el patrón end-to-end, mismo criterio de riesgo que 4a/4b/4c.

**Architecture:** Cuarta oleada de la Fase 4 del spec (`docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`, que nombra `ra-select` explícitamente). 4a-4c cerraron `ra-dropdown`/`ra-badge`/`ra-boton`/`ra-campo`/`ra-buscador`/`ra-modal`.

## Investigación previa (hecha antes de escribir este plan)

Inventario completo (`Explore` agent): **40 `<select>` nativos en 26 archivos**, agrupados en 4 familias de clases distintas (A: `.input-filled` en modales/forms; B: chevron dibujado a mano; C: filtros compactos de página, sin form; D: casos sueltos). Además existen **2 comboboxes de búsqueda ya construidos a mano** (`inscripcion.ts` para paquetes, `asesoria-nutriocional-modal.ts` para socios) — ambos son typeahead con debounce remoto, sin navegación por teclado, y estructuralmente distintos entre sí (uno usa un signal de "abierto" explícito + cierre por click-fuera-del-documento, el otro deriva visibilidad de si hay resultados y no tiene cierre por click-afuera).

**Decisión de alcance — esto es clave**: `ra-select` reemplaza los **40 `<select>` planos** (listas fijas de opciones, sin texto libre) — NO toca los 2 comboboxes de búsqueda con texto libre, que son un patrón distinto (typeahead remoto) y ya tienen su propio estilo razonable. Esto es la misma decisión que excluyó `inscripcion.ts`/`asesoria-nutriocional-modal.ts` de `ra-buscador` en la Fase 4b (Task 6) — un combobox de búsqueda con resultados remotos no es un "select con opciones fijas", es una bestia distinta.

**Diseño visual**: se reutiliza el lenguaje visual ya validado en los 2 comboboxes existentes — panel `rounded-xl2 shadow-card border border-gray-200 bg-white`, filas `w-full px-3 py-2 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50`. El control cerrado usa `.input-filled` (para verse igual que cualquier otro campo de formulario) + un chevron SVG a la derecha (mismo ícono ya usado en los selects "Familia B").

**Decisión técnica — `ControlValueAccessor`**: a diferencia de `ra-boton`/`ra-campo`/`ra-buscador`/`ra-modal` (wrappers presentacionales simples), `ra-select` implementa `ControlValueAccessor` (`NG_VALUE_ACCESSOR`) para poder usarse exactamente como un `<select>` nativo: `<ra-select formControlName="idCategoria">` en forms reactivos, o `[(ngModel)]`/`[ngModel]+(ngModelChange)` en los filtros de página que no usan `FormGroup`. Esto cubre los 3 patrones de binding reales hallados en el catálogo (reactive forms, ngModel de dos vías, ngModel+ngModelChange separado) sin que cada consumidor tenga que reescribir su lógica de binding. Es la pieza más compleja de esta oleada — no hay precedente directo en este repo, requiere cuidado extra en implementación y revisión.

**Capacidad nueva (no existía en ningún select ni combobox de la app)**: navegación completa por teclado (flechas para resaltar, Enter para seleccionar, Escape para cerrar) — ninguno de los 40 selects nativos la necesitaba (el navegador ya se la daba gratis) y ninguno de los 2 comboboxes la tiene. `ra-select` la necesita construir desde cero para no perder accesibilidad al dejar de ser un `<select>` nativo.

**Cambio de patrón para el placeholder**: hoy el texto "Selecciona un gimnasio"/"Selecciona una categoría" vive como una `<option disabled>` dentro de la lista de opciones. En `ra-select` esto se vuelve un input `placeholder` del componente — las opciones pasadas ya NO deben incluir esa opción-placeholder falsa. Documentado aquí para que el implementador no la copie por error.

**Tech Stack:** Angular 20 standalone, signal inputs, `ControlValueAccessor`, `ChangeDetectionStrategy.OnPush`, Karma + Jasmine, Tailwind 4.

**Reglas transversales (las de 4a/4b/4c):**
- Cambia código (no es un move puro): el criterio es "se ve y comporta igual" MÁS las capacidades nuevas documentadas arriba.
- Gates por task: `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false --browsers=ChromeHeadless` (base 455), `npm run build:web`.
- ⚠️ Commits: español, una línea, `feat():`/`refactor():`, SIN trailer de coautoría. Verificar con `git log -1 --format=%B` tras cada commit.
- Nunca commitear `.claude/settings.local.json`.
- El descubrimiento de consumidores es SIEMPRE por grep/lectura real.
- Cuando un revisor encuentre algo real, se corrige antes de seguir.

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b feat/fase-4d-ra-select`
- [ ] `npm run test:ci 2>&1 | tail -3` → `455 SUCCESS`. Si no, DETENTE.

---

### Task 2: Construir `ra-select`

**Files:**
- Create: `src/app/shared/ui/ra-select/ra-select.ts`
- Create: `src/app/shared/ui/ra-select/ra-select.spec.ts`

**API:**

```typescript
export interface RaSelectOpcion<T> {
  valor: T;
  etiqueta: string;
}
```

`ra-select` es genérico (`RaSelect<T>`) porque las opciones reales son tanto `number` (IDs de gimnasio/categoría) como `string` (nombres de rol) según el consumidor.

**Inputs:**
- `opciones = input<RaSelectOpcion<T>[]>([])` — SIN opción-placeholder incluida (ver nota arriba).
- `placeholder = input('Selecciona…')` — se muestra en el control cerrado cuando no hay valor seleccionado.
- `deshabilitado = input(false)` — deshabilitado explícito vía binding directo (ej. `[deshabilitado]="cargandoGimnasios()"`), independiente del mecanismo de CVA. Se combina (OR) con el estado deshabilitado que llegue vía `setDisabledState` (ej. `form.disable()` en un `FormGroup`, o `.disable()` en un `FormControl` individual) — un `ra-select` puede llegar deshabilitado por CUALQUIERA de las dos vías y ambas deben respetarse.

**Output:** ninguno propio — el cambio de valor se comunica exclusivamente vía CVA (`registerOnChange`), que es lo que hace que `formControlName`/`[(ngModel)]`/`(ngModelChange)` funcionen automáticamente en el consumidor sin un `@Output` adicional.

**Comportamiento:**
- Click en el control cerrado abre/cierra el panel. Con el panel abierto, resalta la opción actualmente seleccionada (si existe) al abrir.
- Click en una fila del panel selecciona esa opción, llama `onChange`+`onTouched`, cierra el panel.
- Click fuera del componente (`@HostListener('document:click', ...)`, comprobando `elementRef.nativeElement.contains(event.target)`) cierra el panel si estaba abierto, y llama `onTouched`.
- Teclado (`@HostListener('keydown', ...)` en el host): `Enter`/`Space` abre si está cerrado, o selecciona la opción resaltada si está abierto; `ArrowDown`/`ArrowUp` abren el panel si estaba cerrado y mueven el índice resaltado (clamp a los límites, sin wrap); `Escape` cierra el panel sin seleccionar.
- Con `deshabilitado()` en true (por cualquiera de las 2 vías), el control no abre y no responde a teclado.

**CVA:**
```typescript
implements ControlValueAccessor {
  writeValue(v: T | null): void { this.valorActual.set(v); }
  registerOnChange(fn: (v: T | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.deshabilitadoPorForm.set(isDisabled); }
}
```
Proveedor: `{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RaSelect), multi: true }`.

**Template (boceto — el implementador puede ajustar detalles de accesibilidad/clases mientras preserve el comportamiento anterior):**

```html
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
```

- [ ] **Step 1:** Crear `ra-select.ts` implementando el diseño de arriba.
- [ ] **Step 2:** Crear `ra-select.spec.ts` cubriendo (mínimo, agregar más si se justifica): (a) `writeValue` refleja la etiqueta correcta en el control cerrado, (b) sin valor muestra el `placeholder`, (c) click abre el panel y click de nuevo lo cierra, (d) click en una opción llama `onChange` con el valor correcto y cierra el panel, (e) click fuera del componente cierra el panel, (f) `ArrowDown`/`ArrowUp` mueven el índice resaltado con límites correctos (no baja de 0 ni sube del último), (g) `Enter` con el panel abierto selecciona la opción resaltada, (h) `Escape` cierra sin seleccionar, (i) `deshabilitado=true` bloquea apertura por click Y por teclado, (j) **integración real con Reactive Forms**: un host con `FormGroup`+`formControlName="x"` apuntando a un `ra-select`, verificar que `form.controls.x.setValue(...)` actualiza lo mostrado (vía `writeValue`), que seleccionar una opción actualiza `form.controls.x.value`, y que `form.controls.x.disable()` deshabilita el control (vía `setDisabledState`).
- [ ] **Step 3:** Gates: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.spec.json --noEmit && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5` → limpio, reportar el total real.
- [ ] **Step 4:** `npm run build:web 2>&1 | tail -5` → OK.
- [ ] **Step 5:** Commit:

```bash
git add src/app/shared/ui/ra-select
git commit -m "feat(): construir ra-select (dropdown con estilo propio, ControlValueAccessor)"
```
Verificar sin trailer.

---

### Task 3: Adoptar `ra-select` en `producto-modal` (página piloto 1 — dentro de un formulario reactivo)

**Files:**
- `src/app/features/administracion/pages/producto/producto-modal/producto-modal.html`
- `src/app/features/administracion/pages/producto/producto-modal/producto-modal.ts`

Leer el `.html` COMPLETO antes de tocar (la Categoría/Gimnasio pueden haber cambiado desde que se escribió este plan — re-verificar). Reemplazar el `<select formControlName="gimnasioId" class="input-filled">...</select>` y el `<select formControlName="idCategoria" class="input-filled">...</select>` por `<ra-select formControlName="gimnasioId" [opciones]="opcionesGimnasio()" placeholder="Selecciona un gimnasio"></ra-select>` y análogo para categoría — `formControlName` debería funcionar automáticamente gracias al CVA, sin cambiar la lógica de validación existente (`Validators.required`, `errorGimnasio` getter, etc.).

En el `.ts`: agregar `computed()` que transforme `gimnasios`/`categoriasFiltradas` (arrays de objetos reales) en `RaSelectOpcion<number>[]` (`{ valor: g.idGimnasio, etiqueta: g.nombre }`), SIN incluir ninguna opción-placeholder (eso ahora es el input `placeholder` de `ra-select`). Ojo: `categoriasFiltradas` puede cambiar dinámicamente (según el gimnasio elegido) — el `computed()` debe reaccionar a eso igual que el `@for` original lo hacía.

Agregar `RaSelect` a `imports`.

⚠️ El mensaje "No hay categorías en este gimnasio." (que hoy se muestra como `<p>` condicional debajo del select) y el asterisco de requerido en el label de Categoría (agregado en la Fase 4b) deben preservarse tal cual — no son responsabilidad de `ra-select`.

## Gates: tsc app/spec, tests (455 + los nuevos de `ra-select`), build.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-select en producto-modal (gimnasio y categoria)"
```
Verificar sin trailer.

---

### Task 4: Adoptar `ra-select` en `promociones` (página piloto 2 — filtro de página con `[ngModel]`, sin form)

**Files:**
- `src/app/features/administracion/pages/administracion/promociones/promociones.html`
- `src/app/features/administracion/pages/administracion/promociones/promociones.ts`

Leer el `.html` COMPLETO antes de tocar. El select `gimnasioTablaId` (`[ngModel]="gimnasioTablaId()"` + `(ngModelChange)="onCambiarGimnasioTabla($event)"`, `[disabled]="cargandoGimnasios()"`) se reemplaza por `<ra-select [ngModel]="gimnasioTablaId()" (ngModelChange)="onCambiarGimnasioTabla($event)" [deshabilitado]="cargandoGimnasios()" [opciones]="opcionesGimnasio()"></ra-select>` — este caso valida que `ra-select` funciona con el patrón ngModel de dos direcciones (no reactive forms) Y con el input `deshabilitado` explícito (no hay `FormControl` de por medio aquí, así que el deshabilitado tiene que venir por el input, no por CVA).

En el `.ts`: `computed()` análogo a Task 3 transformando `gimnasios()` (ya es un signal) en `RaSelectOpcion<number>[]`.

Agregar `RaSelect` a `imports`. Confirmar que `FormsModule` (necesario para `[ngModel]`) sigue importado — si `ra-select` no requiere `FormsModule` propio (usa CVA vía la directiva `NgModel` que el consumidor ya trae), no hace falta agregar nada extra en `ra-select.ts` para esto.

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-select en filtro de gimnasio de promociones"
```
Verificar sin trailer.

---

### Task 5: Verificación final de la oleada

- [ ] `npm run verificar` → todos los tests SUCCESS + build con las warnings conocidas.
- [ ] Smoke test manual del usuario (`npm run electron:prod`): abrir "Editar producto"/"Nuevo producto" — probar el select de Gimnasio y Categoría (click para abrir, click en una opción, y probar teclado: flechas + Enter, Escape). Probar guardar con Categoría vacía (debe seguir mostrando el error de requerido). En Promociones, probar el selector "Gimnasio (tabla)" — cambiar de gimnasio debe seguir filtrando la tabla igual que antes.
- [ ] Reportar: total real de tests, confirmación de que `ra-select` está listo pero SOLO adoptado en 2 páginas (producto-modal, promociones — 3 instancias), resto de los 40 `<select>` nativos y los 2 comboboxes de búsqueda quedan fuera de esta oleada, documentado explícitamente.

## Self-review (hecho al escribir el plan)

- **Cobertura:** `ra-select` es la pieza que el spec original nombra como `ra-select` en el catálogo de Fase 4.
- **Alcance:** deliberadamente parcial — 2 páginas, 3 instancias de 40 halladas. Los 2 comboboxes de búsqueda (typeahead remoto) quedan explícitamente fuera, mismo criterio que excluyó `inscripcion.ts`/`asesoria-nutriocional-modal.ts` de `ra-buscador` en 4b.
- **Riesgo:** esta es la pieza más compleja construida hasta ahora en `shared/ui` (primera vez que se implementa `ControlValueAccessor` en este repo) — requiere revisión extra cuidadosa del CVA y de la navegación por teclado, ninguno de los dos con precedente directo para comparar.
- **Fuera de alcance de 4d:** el resto de los 40 selects nativos (adopción masiva diferida, igual que `ra-boton`/`ra-campo`/`ra-modal`), los 2 comboboxes de búsqueda con typeahead, `ra-tabla`/`ra-paginador` (siguiente oleada).
