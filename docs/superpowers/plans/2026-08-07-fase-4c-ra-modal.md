# Fase 4c — `ra-modal`: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Goal:** Construir `ra-modal` — el cascarón compartido (backdrop, panel, header con título/cierre) que reemplaza el backdrop+panel+header duplicado a mano en cada uno de los ~15 modales de la app — y adoptarlo en 2 páginas representativas que validan el patrón end-to-end, siguiendo el mismo criterio de riesgo usado en 4a/4b.

**Architecture:** Tercera oleada de la Fase 4 del spec (`docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`). 4a cerró `ra-dropdown`/`ra-badge`; 4b cerró `ra-boton`/`ra-campo`/`ra-buscador`. Esta oleada construye `ra-modal` y prueba el patrón en 2 páginas reales; la adopción masiva del resto queda para una oleada 4d futura (junto con o después de `ra-tabla`/`ra-paginador`, a decidir cuando se llegue ahí).

## Investigación previa (hecha antes de escribir este plan)

Se hizo un inventario completo de los modales de la app (`Explore` agent, lectura de archivos reales). Hallazgo clave: **hay 23 instancias modal-like, no ~15, y NO son estructuralmente uniformes** — se agrupan en 3 familias:

- **Familia A (8 instancias)** — "solo panel": el componente hijo (`*-modal.ts`) renderiza únicamente el panel blanco (header+form); el backdrop lo arma cada página padre a mano, con inconsistencias reales entre páginas (blur sí/no, opacidad, max-width, si cierra al click afuera). Ejemplos: `usuarios-admin-modal`, `producto-modal`, `stock-modal`, `paquete-modal`, `membresia-modal`, `promocion-modal`, `ventas-admin-modal`, `asesoria-nutriocional-modal`.
- **Familia B (3 instancias)** — self-contained (backdrop+panel+header+cierre todo adentro del propio componente). Incluye un componente **muerto** (`entrenador-modal`, sin consumidores — no tocar) y uno con auto-toggle vía `@Input open` clásico en vez de `@if` del padre (`corte-caja-modal`, con zoom interno — fuera de alcance).
- **Familia C (6 instancias + 1 bespoke)** — modales de confirmación inline en la página (no son componentes separados), envolviendo `<app-resumen-compra>`/`<app-resumen-venta>`. Fuera de alcance de esta oleada (no son "modales" en el sentido de componente reutilizable, son markup de página).

**Decisión de alcance**: esta oleada construye `ra-modal` y lo adopta SOLO en 2 páginas de la Familia A (el patrón más común y más uniforme): `usuarios-admin` (1 modal) y `producto` (2 modales: `producto-modal` + `stock-modal`, valida que `ra-modal` funcione con 2 instancias en la misma página padre). El resto de la Familia A, toda la Familia B (excepto el componente muerto, que no se toca) y la Familia C quedan para una oleada futura — mismo criterio que la adopción parcial de `ra-boton`/`ra-campo` en 4b.

**Deviaciones/normalizaciones deliberadas** (documentadas para que el revisor no las marque como regresión sin contexto):

1. **Cierre con tecla Escape**: NINGUNO de los 2 modales piloto (`usuarios-admin-modal`, `producto-modal`/`stock-modal`) tiene hoy manejo de Escape. `ra-modal` lo agrega de forma centralizada (mejora de UX pura, cero riesgo de regresión — no había nada que perder).
2. **Botón de cerrar**: `producto-modal`/`stock-modal` usan hoy el carácter literal `✕`; `usuarios-admin-modal` usa un SVG con el trazo de una X. `ra-modal` estandariza al SVG (visualmente casi idéntico, normalización cosmética menor).
3. **Padding del header**: `usuarios-admin-modal` tiene `pb-2` en la fila del header; `producto-modal`/`stock-modal` no. `ra-modal` estandariza sin `pb-2` (el patrón de 2 de los 3 modales piloto) — para `usuarios-admin`, esto reduce el espacio entre el título y el body en unos ~8px, un delta menor documentado aquí, no un hallazgo a reportar como bug.
4. **Wrapper de panel duplicado**: hoy tanto `usuarios-admin.html` como `producto.html` envuelven su `<app-x-modal>` en un `<div>` PADRE con sus propias clases de rounded/shadow/ring (`rounded-2xl shadow-2xl ring-1 ring-black/5` en un caso, `rounded-xl2 shadow-card` en el otro), redundante con el wrapper que el propio componente hijo ya trae adentro. `ra-modal` consolida esto en un solo wrapper — la eliminación del wrapper duplicado del padre no debería cambiar nada visualmente (el interno ya dominaba), pero se verifica con smoke test.
5. **Tamaño del título (hallado durante Task 3, no anticipado al escribir este plan)**: `usuarios-admin-modal` tenía `text-[18px]` sin escalar (sin `sm:`), mientras que TODOS los demás modales de la app (`producto-modal`/`stock-modal` en `text-[20px]` flat, y `socio-modal`/`membresia-modal`/`promocion-modal`/`paquete-modal` con `sm:text-[20px]`) convergen a 20px en desktop. `ra-modal` estandariza a `text-[20px]` — para `usuarios-admin` esto es una corrección de consistencia (era el único outlier por debajo del resto), no una regresión. Verificado por el revisor de Task 3 comparando los 6 modales restantes.

**Tech Stack:** Angular 20 standalone, signal inputs (`input()`, `computed()`, `ChangeDetectionStrategy.OnPush`), Karma + Jasmine, Tailwind 4.

**Reglas transversales (las de 4a/4b):**
- Cambia código (no es un move puro): el criterio es "se ve y comporta igual" MÁS las 4 normalizaciones deliberadas de arriba, verificado con smoke test manual, no diff idéntico.
- Componentes nuevos con signal inputs y `OnPush` desde el día uno.
- Gates por task: `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false --browsers=ChromeHeadless` (base 447), `npm run build:web`.
- ⚠️ Commits: español, una línea, `feat():`/`refactor():`, SIN trailer de coautoría. Verificar con `git log -1 --format=%B` tras cada commit.
- Nunca commitear `.claude/settings.local.json`.
- El descubrimiento de consumidores es SIEMPRE por grep/lectura real — las clases exactas de este plan son del 2026-08-07 y deben re-verificarse en el archivo real antes de tocarlo.
- Cuando un revisor encuentre algo real, se corrige antes de seguir.

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b feat/fase-4c-ra-modal`
- [ ] `npm run test:ci 2>&1 | tail -3` → `447 SUCCESS`. Si no, DETENTE.

---

### Task 2: Construir `ra-modal`

**Files:**
- Create: `src/app/shared/ui/ra-modal/ra-modal.ts`
- Create: `src/app/shared/ui/ra-modal/ra-modal.spec.ts`

**Diseño:** basado en el patrón mayoritario de Familia A (backdrop absoluto separado del panel, sin necesidad de `stopPropagation` porque el click en el panel nunca llega al div del backdrop). `titulo` es un string simple para el caso común; para headers con contenido extra (ej. subtítulo de `stock-modal`), se proyecta con `<ng-content select="[ra-modal-subtitulo]">`. El body es un `<ng-content>` sin wrapper propio — cada consumidor mantiene su propio padding en su `<form>`/`<div>` raíz tal cual está hoy, `ra-modal` no impone un padding de body (evita doble padding).

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Output,
  input,
} from '@angular/core';

/** Cascarón compartido para modales: backdrop + panel + header (titulo +
 * cierre). El body se proyecta tal cual (sin padding propio, para no doblar
 * el padding que cada formulario consumidor ya trae). Cierra con click en el
 * backdrop (configurable) y con Escape (siempre, es una mejora nueva — casi
 * ningún modal existente lo tenía). */
@Component({
  selector: 'ra-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        (click)="onBackdropClick()"
      ></div>
      <div class="relative z-10 mx-4 w-full {{ anchoMax() }}">
        <div class="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div class="flex items-start justify-between px-6 pt-5">
            <div class="min-w-0">
              <h2 class="text-ra-slate text-[20px] leading-none font-bold">{{ titulo() }}</h2>
              <ng-content select="[ra-modal-subtitulo]"></ng-content>
            </div>
            <button
              type="button"
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-600 text-white hover:bg-red-700"
              (click)="cerrar.emit()"
              aria-label="Cerrar"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
})
export class RaModal {
  titulo = input('');
  /** Clase Tailwind de ancho máximo del panel (ej. 'max-w-xl', 'max-w-[720px]'). */
  anchoMax = input('max-w-2xl');
  cerrarAlClickFuera = input(true);

  @Output() cerrar = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrar.emit();
  }

  protected onBackdropClick(): void {
    if (this.cerrarAlClickFuera()) this.cerrar.emit();
  }
}
```

- [ ] **Step 1:** Crear `ra-modal.ts` con el código de arriba.
- [ ] **Step 2:** Crear `ra-modal.spec.ts` cubriendo: (a) proyecta título y contenido, (b) click en el backdrop emite `cerrar`, (c) click dentro del panel NO emite `cerrar`, (d) `cerrarAlClickFuera=false` desactiva el cierre por click afuera, (e) tecla Escape emite `cerrar`, (f) `anchoMax` cambia la clase aplicada, (g) `[ra-modal-subtitulo]` proyecta contenido extra en el header.
- [ ] **Step 3:** Gates: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.spec.json --noEmit && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5` → limpio, reportar el total real.
- [ ] **Step 4:** `npm run build:web 2>&1 | tail -5` → OK.
- [ ] **Step 5:** Commit:

```bash
git add src/app/shared/ui/ra-modal
git commit -m "feat(): construir ra-modal (backdrop, panel, header y cierre compartidos)"
```
Verificar sin trailer.

---

### Task 3: Adoptar `ra-modal` en `usuarios-admin` (página piloto 1)

**Files:**
- `src/app/features/administracion/pages/administracion/usuarios-admin/usuarios-admin.html` (quitar el backdrop+wrapper duplicado que arma hoy)
- `src/app/features/administracion/pages/administracion/usuarios-admin/usuarios-admin-modal/usuarios-admin-modal.html` (quitar el panel/header/botón cerrar propios, envolver el resto en `<ra-modal>`)
- `src/app/features/administracion/pages/administracion/usuarios-admin/usuarios-admin-modal/usuarios-admin-modal.ts` (agregar `RaModal` a imports)

Leer ambos `.html` COMPLETOS antes de tocar. En `usuarios-admin.html`, el bloque `@if (modalAbierto()) { <div class="fixed inset-0..."> ... }` se reemplaza por simplemente `@if (modalAbierto()) { <app-usuarios-admin-modal ...></app-usuarios-admin-modal> }` (sin ningún wrapper — el backdrop ahora vive dentro de `ra-modal`, dentro de `usuarios-admin-modal`). En `usuarios-admin-modal.html`, el `<div class="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">` raíz + su header propio (h2 + botón cerrar SVG) se reemplazan por `<ra-modal titulo="..." anchoMax="max-w-[720px]" (cerrar)="cancelar.emit()">`, envolviendo el resto del contenido (el `@if (cargando) {...} @else {...}` con el form) tal cual estaba. El `titulo` dinámico (`idUsuario ? 'Editar usuario #'+idUsuario : 'Crear usuario'`) se pasa como `[titulo]="tituloModal"` — mover la expresión a un getter en el `.ts` si hoy vive inline (para legibilidad, mismo criterio que `ra-campo` en 4b).

## Gates: tsc app/spec, tests (447 + los nuevos de `ra-modal`), build.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-modal en usuarios-admin"
```
Verificar sin trailer.

---

### Task 4: Adoptar `ra-modal` en `producto` (página piloto 2 — 2 modales en la misma página)

**Files:**
- `src/app/features/administracion/pages/producto/producto.html` (quitar los 2 backdrops+wrappers duplicados)
- `src/app/features/administracion/pages/producto/producto-modal/producto-modal.html` + `.ts`
- `src/app/features/administracion/pages/producto/stock-modal/stock-modal.html` + `.ts`

Mismo procedimiento que Task 3, para ambos modales de esta página. **`stock-modal` es el caso con subtítulo de 2 líneas bajo el título** (nombre del producto + stock actual) — proyectarlo con `<p ra-modal-subtitulo>...</p>` (dos elementos, ambos con el atributo `ra-modal-subtitulo`) dentro de `<ra-modal>`, en vez del `<div class="min-w-0">` que hoy envuelve el h2+párrafos a mano. Verificar que `[title]="producto.nombre"` (tooltip nativo) y las clases de truncado (`truncate`) se preservan tal cual en el `<p>` proyectado.

`anchoMax`: `producto-modal` usa hoy `max-w-2xl` (coincide con el default de `ra-modal`, se puede omitir el input o pasarlo explícito por claridad), `stock-modal` usa `max-w-xl`.

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-modal en producto-modal y stock-modal"
```
Verificar sin trailer.

---

### Task 5: Verificación final de la oleada

- [ ] `npm run verificar` → todos los tests SUCCESS + build con las warnings conocidas.
- [ ] Smoke test manual del usuario (`npm run electron:prod`): abrir "Crear usuario"/"Editar usuario" en usuarios-admin — verificar que el modal se ve y comporta igual (más Escape para cerrar, nuevo); abrir "Editar producto" y "Ajustar stock" en productos — verificar ambos modales, especialmente que el subtítulo de stock-modal (nombre del producto + stock actual) se ve en el mismo lugar que antes.
- [ ] Reportar: total real de tests, confirmación de que `ra-modal` está listo pero SOLO adoptado en 2 páginas (usuarios-admin, producto — 3 instancias de modal en total), resto de la Familia A (paquete-modal, membresia-modal, promocion-modal, ventas-admin-modal, asesoria-nutriocional-modal) y las Familias B/C quedan para una oleada futura, documentado explícitamente.

## Self-review (hecho al escribir el plan)

- **Cobertura:** `ra-modal` cubre backdrop+panel+header+cierre, que es lo que pide el spec original para esta pieza del catálogo de Fase 4.
- **Alcance:** adopción deliberadamente parcial (2 páginas, 3 instancias de 23 halladas) — incluso más conservador que 4b porque el inventario reveló 3 familias estructuralmente distintas, no una sola forma; forzar una adopción amplia ahora habría sido arriesgado sin antes validar el patrón.
- **Riesgo:** se identificaron por adelantado las 4 normalizaciones deliberadas (Escape nuevo, glifo de cierre, padding de header, wrapper duplicado) para que el implementador no las trate como hallazgos nuevos ni el revisor las marque como regresión sin contexto.
- **Fuera de alcance de 4c:** resto de Familia A (5 modales), Familia B completa (`corte-caja-modal`, `corte-caja-info`; `entrenador-modal` está muerto, no se toca en ninguna oleada sin decisión explícita de borrarlo), Familia C (6 modales de confirmación inline + 1 bespoke en `reinscripcion.html`), `ra-tabla`/`ra-paginador` (4d o posterior), adopción masiva de `ra-boton`/`ra-campo` (diferida desde 4b).
