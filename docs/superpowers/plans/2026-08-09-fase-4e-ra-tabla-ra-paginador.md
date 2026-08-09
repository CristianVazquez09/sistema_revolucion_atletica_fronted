# Fase 4e — `ra-tabla` y `ra-paginador`: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Goal:** Construir `ra-tabla` (cascarón de tabla: scroll horizontal, estados de cargando/error/vacío) y `ra-paginador` (controles de paginación con inputs primitivos, agnóstico a la forma real del objeto de página que use cada backend). Adoptar ambos en 2 páginas representativas que validan el patrón contra las 2 convenciones divergentes de paginación halladas en el catálogo.

**Architecture:** Quinta oleada de la Fase 4 del spec (`docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`). 4a-4d cerraron `ra-dropdown`/`ra-badge`/`ra-boton`/`ra-campo`/`ra-buscador`/`ra-modal`/`ra-select`.

## Investigación previa (hecha antes de escribir este plan)

Inventario completo (`Explore` agent): **~19 `<table>` reales** en `src/app/features/**`. 17 de ellas comparten un shell **idéntico** (mismas clases exactas de outer card, scroll container, `<table>`, `<thead>` sticky+blur, filas con hover, y el mismo patrón de 3 ramas `@if(cargando)/@else if(error)/@else if(vacío)/@else{filas}` con `colspan="99"` — el mismo hack de "spanea cualquier cantidad de columnas" en las 17). Las acciones por fila YA están 100% migradas a `ra-dropdown` en las 17 — no hay menús hechos a mano que migrar ahí. 2 tablas divergen fuerte (`estadisticas.html` usa un sistema de diseño SCSS completamente distinto; `punto-venta.html` tiene selección de fila por click en vez de menú de acciones) y quedan **fuera de alcance**, mismo criterio que excluyó a `inscripcion.ts`/`asesoria-nutriocional-modal.ts` de `ra-buscador` en 4b.

**Hallazgo clave sobre paginación — 2 convenciones incompatibles conviven en la app hoy:**

- **Patrón A** (`socio.ts`, `asistencia-historial.ts`, `historial.ts`, `socio-informacion.ts`, `socio-info-asesoria.ts`): usa el modelo compartido `PagedResponse<T>`/`InfoPagina` (`src/app/shared/models/paged-response.ts`, campos en español: `pagina.tamanio/numero/totalElementos/totalPaginas`), estado `paginaActual` (0-based) y métodos `irAnterior()`/`irSiguiente()`.
- **Patrón B** (`membresia.ts`, `ventas-admin.ts`, `corte-caja-admin.ts`): usa un tipo local `PageMeta` redeclarado en cada archivo (campos en inglés estilo Spring: `size/number/totalElements/totalPages`), un getter `pageUI` (**1-based**, `page.number + 1`), y métodos `prev()`/`next()`/`go(pageUI)`.

Ningún backend/modelo compartido unifica esto — es un problema real y preexistente, no algo que esta oleada vaya a resolver. **Decisión de diseño**: `ra-paginador` NO recibe el objeto de página crudo (`PagedResponse`/`PageMeta`) — recibiría 2 formas incompatibles y tendría que adivinar cuál. En su lugar recibe **inputs primitivos ya normalizados por el consumidor** (`paginaActual` 0-based, `totalPaginas`, `totalElementos`, `tamanioPagina`, `tamaniosDisponibles`) y emite un **índice de página objetivo 0-based** vía `(irAPagina)`. Cada página sigue siendo responsable de mapear su propio estado (`paginaActual`/`page.number`) a estos primitivos, y de mapear el evento 0-based de vuelta a su propia convención si hace falta (ver Task 4 — `membresia.ts` es 1-based internamente vía `pageUI`, así que su handler resta 1... o suma 1, según se lea; documentado ahí). Esto es exactamente el mismo criterio que ya se usó para `ra-buscador` (no le importa si el consumidor usa `switchMap` o no) y `ra-select` (no le importa si el consumidor usa reactive forms o `ngModel`) — el componente compartido no absorbe la lógica de negocio de cada consumidor, solo el cascarón visual+interacción.

**Hallazgo adicional, no bloqueante — documentado para no perderlo**: `socio.ts` tiene métodos `irPrimera()`/`irUltima()` ya escritos pero **sin ningún botón conectado en el template** (código muerto de una intención no terminada). Ninguna página de la app tiene botones "Primera"/"Última" hoy — todas usan solo "Anterior"/"Siguiente". **Decisión de alcance**: `ra-paginador` replica el footer EXACTO que existe hoy (solo Anterior/Siguiente) — no se agregan botones nuevos en esta oleada (agregarlos sería un cambio de UI visible no pedido, no un cascarón). Se deja como nota de backlog.

**Hallazgo adicional — `entrenador-info-asesoria.ts` pagina en el cliente** (trae la lista completa y hace slicing local), a diferencia de su gemela `socio-info-asesoria.ts` que pagina en servidor con un endpoint real. Esto es una inconsistencia de backend preexistente, fuera de alcance total de esta oleada — no se toca ninguna de las dos en este plan.

**Decisión de diseño — selects de "Por página"**: hoy son 100% `<select>` nativos en todas las páginas con paginación. `ra-paginador` los reemplaza internamente con `ra-select` (ya construido en 4d, con `tamano="compacto"` ya validado para este mismo tipo de control angosto) — cierra ese hueco como efecto colateral de construir `ra-paginador`, sin que sea una oleada de migración de selects aparte.

**Decisión de alcance de `ra-tabla`**: el div exterior de la tarjeta completa (`shadow-card mx-1 overflow-hidden rounded-xl bg-white ring-1 ring-black/10`) que hoy envuelve TOOLBAR + TABLA + FOOTER como una sola tarjeta **se queda en cada página**, no lo absorbe `ra-tabla` — porque ese wrapper también contiene el toolbar (buscador, filtros) y el footer de paginación, que no son parte conceptual de "la tabla". `ra-tabla` solo envuelve el contenedor de scroll horizontal + el `<table>` + el manejo de estados (cargando/error/vacío) — igual de acotado que `ra-campo` (label+control+error, no el formulario completo) o `ra-modal` (backdrop+panel+header, no el contenido del formulario). El header (`<thead>`) se proyecta tal cual desde cada página (columnas 100% distintas por tabla, no tiene sentido generalizarlas); las filas de datos (`<tr>` reales) también se proyectan tal cual cuando NO se está en un estado especial.

**Tech Stack:** Angular 20 standalone, signal inputs, `ChangeDetectionStrategy.OnPush`, Karma + Jasmine, Tailwind 4.

**Reglas transversales (las de 4a-4d):**
- Cambia código (no es un move puro): el criterio es "se ve y comporta igual" MÁS las normalizaciones documentadas arriba (page-size select ahora es `ra-select`).
- Gates por task: `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false --browsers=ChromeHeadless` (base 474), `npm run build:web`.
- ⚠️ Commits: español, una línea, `feat():`/`refactor():`, SIN trailer de coautoría. Verificar con `git log -1 --format=%B` tras cada commit.
- Nunca commitear `.claude/settings.local.json`.
- El descubrimiento de consumidores es SIEMPRE por grep/lectura real — releer el archivo real antes de tocarlo, las clases de este plan son del 2026-08-09.
- Cuando un revisor encuentre algo real, se corrige antes de seguir.

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b feat/fase-4e-ra-tabla-ra-paginador`
- [ ] `npm run test:ci 2>&1 | tail -3` → `474 SUCCESS`. Si no, DETENTE.

---

### Task 2: Construir `ra-tabla`

**Files:**
- Create: `src/app/shared/ui/ra-tabla/ra-tabla.ts`
- Create: `src/app/shared/ui/ra-tabla/ra-tabla.spec.ts`

**Diseño:**

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Cascarón de tabla: contenedor de scroll horizontal + `<table>` + manejo
 * de los 3 estados especiales (cargando/error/vacío) con el mismo hack de
 * `colspan="99"` que ya usan las 17 tablas reales (spanea cualquier cantidad
 * de columnas sin que cada consumidor tenga que contar las suyas).
 *
 * El `<thead>` se proyecta completo vía `[ra-tabla-head]` (las columnas son
 * 100% distintas por tabla). Las filas `<tr>` reales se proyectan como
 * contenido por defecto, SOLO se muestran cuando no aplica ningún estado
 * especial — `ra-tabla` no sabe nada de qué hay adentro de cada fila. */
@Component({
  selector: 'ra-tabla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full table-fixed border-collapse text-xs {{ ancho() }}">
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
```

- [ ] **Step 1:** Crear `ra-tabla.ts` con el diseño de arriba.
- [ ] **Step 2:** Crear `ra-tabla.spec.ts` cubriendo: (a) proyecta el `<thead>` (vía `[ra-tabla-head]`) y las filas reales cuando no hay estado especial, (b) `cargando=true` muestra el mensaje de cargando y NO proyecta las filas, (c) `error` (string no vacío) muestra el mensaje de error en rojo y NO proyecta las filas — y tiene prioridad sobre `vacio` si ambos están activos a la vez (verificar el orden real `@if/@else if` del template), (d) `vacio=true` (sin cargando ni error) muestra el mensaje de vacío y NO proyecta las filas, (e) `mensajeCargando`/`mensajeVacio` custom se reflejan en vez del default, (f) `ancho` se aplica como clase en el `<table>`.
- [ ] **Step 3:** Gates: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.spec.json --noEmit && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5` → limpio, reportar el total real.
- [ ] **Step 4:** `npm run build:web 2>&1 | tail -5` → OK.
- [ ] **Step 5:** Commit:

```bash
git add src/app/shared/ui/ra-tabla
git commit -m "feat(): construir ra-tabla (scroll horizontal y estados de cargando/error/vacio)"
```
Verificar sin trailer.

---

### Task 3: Construir `ra-paginador`

**Files:**
- Create: `src/app/shared/ui/ra-paginador/ra-paginador.ts`
- Create: `src/app/shared/ui/ra-paginador/ra-paginador.spec.ts`

**Diseño:**

```typescript
import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RaSelect, RaSelectOpcion } from 'src/app/shared/ui/ra-select/ra-select';

/** Controles de paginación (info de página + selector de tamaño + Anterior/
 * Siguiente). Deliberadamente NO recibe un `PagedResponse`/`PageMeta` crudo
 * — la app tiene 2 formas de objeto de página incompatibles conviviendo hoy
 * (una en español vía `InfoPagina`, otra local en inglés estilo Spring), así
 * que este componente solo pide los valores primitivos ya normalizados por
 * cada consumidor, y emite un índice de página objetivo 0-based — el
 * consumidor decide cómo traducirlo a su propia convención interna. */
@Component({
  selector: 'ra-paginador',
  standalone: true,
  imports: [FormsModule, RaSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs"
    >
      <div class="text-ra-slate/70 flex shrink-0 items-center gap-2">
        <span>
          Página <strong class="text-ra-slate">{{ paginaActual() + 1 }}</strong> de
          <strong class="text-ra-slate">{{ totalPaginas() }}</strong>
        </span>
        <span class="text-ra-slate/50">({{ totalElementos() }} registros)</span>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto">
        <span class="text-ra-slate/60 shrink-0 whitespace-nowrap">Por página</span>
        <div class="w-[70px] shrink-0">
          <ra-select
            tamano="compacto"
            [opciones]="opcionesTamanio()"
            [ngModel]="tamanioPagina()"
            (ngModelChange)="cambiarTamanio.emit($event)"
          ></ra-select>
        </div>

        <div class="h-4 w-px shrink-0 bg-gray-200"></div>

        <button
          class="h-8 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs hover:bg-gray-50 disabled:opacity-40"
          [disabled]="paginaActual() === 0"
          (click)="irAPagina.emit(paginaActual() - 1)"
        >
          Anterior
        </button>
        <button
          class="h-8 shrink-0 rounded-lg border border-gray-200 bg-white px-3 text-xs hover:bg-gray-50 disabled:opacity-40"
          [disabled]="paginaActual() + 1 >= totalPaginas()"
          (click)="irAPagina.emit(paginaActual() + 1)"
        >
          Siguiente
        </button>
      </div>
    </div>
  `,
})
export class RaPaginador {
  /** 0-based, igual que `InfoPagina.numero`. */
  paginaActual = input.required<number>();
  totalPaginas = input.required<number>();
  totalElementos = input.required<number>();
  tamanioPagina = input.required<number>();
  tamaniosDisponibles = input<number[]>([10, 25, 50]);

  protected readonly opcionesTamanio = computed<RaSelectOpcion<number>[]>(() =>
    this.tamaniosDisponibles().map((t) => ({ valor: t, etiqueta: String(t) })),
  );

  /** Emite el índice de página OBJETIVO, 0-based. */
  @Output() irAPagina = new EventEmitter<number>();
  @Output() cambiarTamanio = new EventEmitter<number>();
}
```

- [ ] **Step 1:** Crear `ra-paginador.ts` con el diseño de arriba.
- [ ] **Step 2:** Crear `ra-paginador.spec.ts` cubriendo: (a) muestra "Página X de Y" y el conteo de registros correctamente, (b) botón "Anterior" deshabilitado cuando `paginaActual=0`, habilitado en otro caso, y al hacer click emite `irAPagina` con `paginaActual - 1`, (c) botón "Siguiente" deshabilitado cuando `paginaActual + 1 >= totalPaginas`, y al hacer click emite `irAPagina` con `paginaActual + 1`, (d) cambiar el tamaño de página (a través del `ra-select` interno) emite `cambiarTamanio` con el valor elegido, (e) `tamaniosDisponibles` custom se refleja en las opciones del select.
- [ ] **Step 3:** Gates completos.
- [ ] **Step 4:** Commit:

```bash
git add src/app/shared/ui/ra-paginador
git commit -m "feat(): construir ra-paginador (inputs primitivos, agnostico a la forma del PagedResponse)"
```
Verificar sin trailer.

---

### Task 4: Adoptar `ra-tabla` + `ra-paginador` en `socio` (página piloto 1 — Patrón A, `PagedResponse`/`InfoPagina`)

**Files:**
- `src/app/features/socios/pages/socio/socio.html`
- `src/app/features/socios/pages/socio/socio.ts`

Leer el `.html` COMPLETO antes de tocar (puede haber cambiado desde este plan — re-verificar clases exactas). El outer card (`shadow-card mx-1 overflow-hidden rounded-xl bg-white ring-1 ring-black/10`) se queda en la página, envolviendo TOOLBAR + `<ra-tabla>` + `<ra-paginador>` como antes.

Reemplazar el bloque `<div class="overflow-x-auto"><div><table>...</table></div></div>` por:

```html
<ra-tabla
  ancho="min-w-[700px]"
  [cargando]="cargando"
  [error]="mensajeError"
  [vacio]="listaSocios.length === 0"
>
  <thead ra-tabla-head class="bg-ra-grayLight/40 sticky top-0 z-10 backdrop-blur">
    ... (colgroup + tr de columnas, IDÉNTICO al actual, incluyendo el `@if (isAdmin)` de la columna Gimnasio) ...
  </thead>
  @for (s of listaSocios; track s.idSocio; let i = $index) {
    <tr class="border-t border-gray-100 hover:bg-gray-50/60"> ... (idéntico) ... </tr>
  }
</ra-tabla>
```

⚠️ El `<colgroup>` va DENTRO del `<thead ra-tabla-head>` proyectado (antes de la `<tr>`) — verificar que sigue funcionando igual dentro de un `<thead>` que ahora es contenido proyectado (debería, `<colgroup>` es válido en cualquier posición directa dentro de `<table>` según HTML, pero aquí termina como hijo directo de `<thead>` en vez de `<table>` — ⚠️ REVISAR ESTO: si `<colgroup>` deja de funcionar por estar dentro del `<thead>` proyectado en vez de directo bajo `<table>`, moverlo a un slot separado `[ra-tabla-colgroup]` o dejarlo fuera de la proyección y agregar un input `anchoColumnas`/proyectarlo con su propio selector — decidir al implementar, verificando visualmente que las columnas mantengan su ancho).

Reemplazar el footer de paginación completo por:

```html
<ra-paginador
  [paginaActual]="paginaActual"
  [totalPaginas]="totalPaginas"
  [totalElementos]="totalElementos"
  [tamanioPagina]="tamanioPagina"
  [tamaniosDisponibles]="tamaniosDisponibles"
  (irAPagina)="irAPaginaSocio($event)"
  (cambiarTamanio)="cambiarTamanioPagina($event)"
></ra-paginador>
```

En `socio.ts`: agregar un método `irAPaginaSocio(pagina: number): void { this.paginaActual = pagina; this.cargarSocios(); }` (verificar el patrón real de cómo `irAnterior()`/`irSiguiente()` cargan hoy — puede que solo necesiten setear `paginaActual` y llamar a `cargarSocios()`, replicar exactamente esa lógica). Los métodos viejos `irAnterior()`/`irSiguiente()` quedan sin uso — si nada más los llama, eliminarlos (verificar con grep antes). Los métodos muertos `irPrimera()`/`irUltima()` (documentados arriba como código muerto preexistente) se dejan tal cual — no son parte de esta tarea.

Agregar `RaTabla, RaPaginador` a `imports`.

## Gates: tsc app/spec, tests (474 + los nuevos de esta oleada), build.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-tabla y ra-paginador en socio"
```
Verificar sin trailer.

---

### Task 5: Adoptar `ra-tabla` + `ra-paginador` en `membresia` (página piloto 2 — Patrón B, `PageMeta` local + sort)

**Files:**
- `src/app/features/administracion/pages/administracion/membresia/membresia.html`
- `src/app/features/administracion/pages/administracion/membresia/membresia.ts`

Mismo procedimiento que Task 4 para la tabla. Para el footer: `ra-paginador` reemplaza la parte de "Por página" + Anterior/Siguiente, PERO los selects de "Ordenar por" (`sortCampo`/`sortDir`) **NO son parte de `ra-paginador`** — se quedan en el `.html` de la página, como hermanos de `<ra-paginador>` dentro del mismo footer `<div class="flex flex-wrap items-center justify-between...">`. Verificar cómo queda el layout con ambos elementos compartiendo la fila — puede requerir separar el footer en 2 `<div>`s (uno para orden+tamaño+navegación via ra-paginador, o dejar los selects de orden ANTES de `<ra-paginador>` en el mismo contenedor flex derecho) — priorizar que se vea igual que antes sobre una refactorización más profunda del layout.

⚠️ Conversión de índices — este es el punto más delicado de esta tarea: `membresia.ts` es **1-based internamente** (`pageUI = page.number + 1`, `cargar(pageUI: number)`). `ra-paginador` trabaja en **0-based** (`paginaActual` = `page.number`, que ya es 0-based — usarlo directo). Al recibir `(irAPagina)="$event"` (0-based, el índice de página AL QUE SE QUIERE IR), convertir a la llamada 1-based existente: `(irAPagina)="onIrAPaginaMembresia($event)"` con `onIrAPaginaMembresia(pagina0Based: number): void { this.cargar(pagina0Based + 1); }`. Verificar esta aritmética contra el código real de `cargar()`/`pageUI`/`prev()`/`next()` antes de asumir — leer el archivo completo primero.

`[paginaActual]="page.number"` (ya 0-based, NO usar `pageUI`). `[totalPaginas]="page.totalPages"`, `[totalElementos]="page.totalElements"`, `[tamanioPagina]="sizeSel"`, `(cambiarTamanio)="onCambiarTamanioMembresia($event)"` con `onCambiarTamanioMembresia(n: number): void { this.sizeSel = n; this.go(1); }` (verificar contra el `(change)="go(1)"` real que hoy dispara el select de tamaño).

Los métodos viejos `prev()`/`next()`/`puedePrev`/`puedeNext` quedan sin uso si nada más los llama (verificar con grep) — `ra-paginador` calcula sus propios estados `disabled` internamente a partir de `paginaActual`/`totalPaginas`, no necesita que la página se los pase.

Agregar `RaTabla, RaPaginador` a `imports`.

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-tabla y ra-paginador en membresia (con conversion de indices 1-based a 0-based)"
```
Verificar sin trailer.

---

### Task 6: Verificación final de la oleada

- [ ] `npm run verificar` → todos los tests SUCCESS + build con las warnings conocidas.
- [ ] Smoke test manual del usuario (`npm run electron:prod`): en Socios — verificar que la tabla se ve igual, que cargando/vacío/error se ven correctamente (probar un filtro que dé 0 resultados), y que Anterior/Siguiente/cambiar tamaño de página funcionan y cargan los datos correctos. En Membresías — mismos checks, MÁS verificar que los selects de "Ordenar por" siguen funcionando y que cambiar de página no rompe el ordenamiento activo (el bug más probable de la conversión 1-based/0-based: si la aritmética queda invertida, "Siguiente" retrocedería en vez de avanzar, o "Anterior" quedaría deshabilitado en la primera página real pero mostraría la página equivocada — probar explícitamente navegar 2-3 páginas hacia adelante y hacia atrás y confirmar que los datos mostrados correspondan a la página indicada).
- [ ] Reportar: total real de tests, confirmación de que `ra-tabla`/`ra-paginador` están listos pero SOLO adoptados en 2 páginas (17 tablas reales del catálogo, 15 quedan pendientes de una oleada futura — 2 explícitamente excluidas del catálogo por ser demasiado divergentes), y que el hallazgo de `entrenador-info-asesoria.ts` (paginación cliente vs servidor) y los métodos muertos `irPrimera`/`irUltima` quedan documentados como backlog, no resueltos aquí.

## Self-review (hecho al escribir el plan)

- **Cobertura:** `ra-tabla`/`ra-paginador` son las 2 piezas que cierran el catálogo completo de componentes de Fase 4 nombrados en el spec original.
- **Alcance:** deliberadamente parcial — 2 páginas de 17 tablas reales adoptables (2 más quedan excluidas del catálogo por divergencia estructural). Mismo criterio de riesgo que todas las oleadas anteriores.
- **Riesgo:** el punto más delicado es la conversión de índices 1-based/0-based en `membresia.ts` (Task 5) — documentado explícitamente para que el implementador y el revisor le den atención extra, con un caso de prueba manual específico en el smoke test.
- **Fuera de alcance de 4e:** el resto de las 15 tablas adoptables, las 2 tablas excluidas del catálogo (`estadisticas.html`, `punto-venta.html`), la inconsistencia de paginación cliente/servidor entre `socio-info-asesoria.ts`/`entrenador-info-asesoria.ts` (requiere trabajo de backend, no es un problema de componente compartido), los botones "Primera"/"Última" nunca conectados en `socio.ts` (código muerto preexistente, no se activa ni se borra en esta oleada), unificación de `ra-badge` en las tablas que aún usan pills hechos a mano.
