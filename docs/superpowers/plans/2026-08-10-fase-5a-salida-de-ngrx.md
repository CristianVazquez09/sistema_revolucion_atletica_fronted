# Fase 5a — Salida de NgRx: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Goal:** Eliminar `@ngrx/store`, `@ngrx/effects`, `@ngrx/store-devtools` del proyecto, reemplazando el store de NgRx de `inscripcion`/`reinscripcion` por servicios con signals (mismo patrón ya usado en `CarritoService`). **Cero cambios de comportamiento** — esta oleada es solo un cambio de mecanismo de estado, no toca la lógica de precios/promociones en sí (eso es una oleada futura: `calculo-membresia-service`).

**Architecture:** Primera sub-oleada de la Fase 5 del spec (`docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`). Fases 1-4 completas (limpieza, tests, reorganización de carpetas, sistema de diseño `shared/ui`).

## Investigación previa (hecha antes de escribir este plan)

**Alcance real de NgRx — mucho más angosto de lo que el spec original sugiere**: `@ngrx/effects` y `@ngrx/store-devtools` están instalados pero **no se usan en ningún lado** (cero `createEffect`, cero `EffectsModule`, cero `provideEffects()`/`provideStoreDevtools()` en `app.config.ts`) — son dependencias muertas, su eliminación es un simple `npm uninstall`. Solo `@ngrx/store` tiene código real, y **solo en 2 features**: `inscripcion` y `reinscripcion` (9 archivos en total, `app.config.ts` incluido). `reinscripcion-adelantada.ts` y `agregar-membresia.ts` — aunque forman parte de la misma familia de flujos de inscripción — **no usan NgRx en absoluto**, ya son 100% signals/servicios.

**Estado que maneja el store (idéntico shape en ambas features):**
```typescript
interface InscripcionState /* y ReinscripcionState, misma forma */ {
  listaPaquetes: PaqueteData[];
  paqueteId: number;
  descuento: number;   // MONTO, no porcentaje
  fechaInicio: string; // ISO YYYY-MM-DD
}
```
Acciones (idénticas en estructura, distinto `source`): `setListaPaquetes`, `setPaqueteId`, `setDescuento`, `setFechaInicio`, `reset`.

**⚠️ HALLAZGO CRÍTICO — los selectores derivados de `inscripcion` y `reinscripcion` YA SON DISTINTOS entre sí hoy, no son código duplicado idéntico:**

| Selector | `inscripcion` (más robusto) | `reinscripcion` (más simple) |
|---|---|---|
| `selectPaqueteActual` (matching de ID) | `getId(p)` — soporta `idPaquete`/`paqueteId`/`id`/`id_paquete`, con `Number.isFinite` guard | `Number(p.idPaquete)` directo, sin fallback de llaves alternativas |
| `selectPrecioPaquete` | `Number(p?.precio ?? 0) || 0` (doble guarda anti-NaN) | `Number(p?.precio ?? 0)` (sin el `\|\| 0` extra) |
| `selectCostoInscripcion` | Existe | **No existe en reinscripción** |
| `selectTotalSinDescuento` | `calcularTotal(precio, 0, costoInscripcion)` (función compartida, redondea a 2 decimales) | `precio` tal cual, sin pasar por `calcularTotal` |
| `selectTotalVista` | `calcularTotal(precio, descuento, costoInscripcion)` | `Math.max(0, precio - descuento)` — fórmula distinta, sin redondeo, sin costo de inscripción |
| `selectFechaPagoVista` | `calcularFechaFin(fechaInicio, paquete.tiempo)` — calcula fecha de FIN sumando la duración del plan | `fechaInicio` tal cual, sin calcular nada — **literalmente devuelve la fecha de INICIO, no de fin** |

**Esta oleada preserva estas diferencias EXACTAS, byte por byte, para cada store.** NO se unifican, NO se "arreglan" (aunque `selectFechaPagoVista` de reinscripción claramente no hace lo que su nombre promete — eso es una inconsistencia real de negocio, documentada aquí como hallazgo, pero corregirla es trabajo de la oleada `calculo-membresia-service`, NO de esta). Cambiar cualquier fórmula aquí sería una regresión de negocio disfrazada de refactor de infraestructura.

**Consumo real del store por componente** (verificado con grep, no asumido):
- `inscripcion.ts`: lee 3 signals (`paqueteActualSig`, `fechaPagoVistaSig`, `paqueteIdSelSig`) vía `store.selectSignal(...)`; despacha `setPaqueteId`/`setFechaInicio`/`setDescuento`/`setListaPaquetes`/`reset` en ~15 sitios.
- `reinscripcion.ts`: lee 8 signals (`listaPaquetesSig`, `paqueteActualSig`, `precioPaqueteSig`, `totalVistaSig`, `totalSinDescSig`, `fechaPagoVistaSig`, `descuentoSelSig`, `fechaInicioSelSig`, `paqueteIdSelSig`) — más signals que inscripción porque calcula menos por su cuenta; despacha en ~5 sitios.

**Precedente de patrón signals ya validado en este repo**: `src/app/features/punto-venta/data/carrito-service.ts` — `signal()` privados de escritura + `computed()` públicos de solo lectura + métodos nombrados para mutar/leer (no exponer signals de escritura directamente). Los nuevos stores siguen este mismo idioma, no uno nuevo.

**Tests existentes a portar** (pinean el comportamiento actual, incluidas las divergencias de la tabla de arriba — deben seguir pasando con los MISMOS valores esperados tras el port, no nuevos):
- `inscripcion/state/inscripcion-state.spec.ts` (390 líneas)
- `reinscripcion/state/reinscripcion-state.spec.ts` (289 líneas)

**Ubicación de los nuevos stores**: `src/app/features/inscripciones/data/` (ya existe, contiene `historial-service.ts` — los stores son nuevos hermanos ahí, no una carpeta nueva).

**Tech Stack:** Angular 20 standalone, signals (`signal()`, `computed()`), Karma + Jasmine.

**Reglas transversales:**
- **Cero cambios de comportamiento** — es la regla más importante de todo este plan. Si algo parece un bug real (como `selectFechaPagoVista` de reinscripción), se documenta, NO se arregla aquí.
- Gates por task: `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false --browsers=ChromeHeadless` (base 492), `npm run build:web`.
- ⚠️ Commits: español, una línea, `feat():`/`refactor():`/`chore():`, SIN trailer de coautoría. Verificar con `git log -1 --format=%B` tras cada commit.
- Nunca commitear `.claude/settings.local.json`.
- Cuando un revisor encuentre algo real, se corrige antes de seguir. Dado que esta oleada toca cálculos usados por dinero real, la revisión de cada task debe comparar FÓRMULA POR FÓRMULA el selector viejo contra el signal nuevo, no solo "pasan los tests".

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b feat/fase-5a-salida-de-ngrx`
- [ ] `npm run test:ci 2>&1 | tail -3` → `492 SUCCESS`. Si no, DETENTE.

---

### Task 2: Construir `InscripcionStore` (signals) + portar sus tests

**Files:**
- Create: `src/app/features/inscripciones/data/inscripcion-store.ts`
- Create: `src/app/features/inscripciones/data/inscripcion-store.spec.ts` (portado de `inscripcion-state.spec.ts` — leer el original completo primero)

Leer COMPLETOS antes de tocar: `inscripcion-models.ts`, `inscripcion-actions.ts`, `inscripcion-reducer.ts`, `inscripcion-selectors.ts`, `inscripcion-state.spec.ts`, y `carrito-service.ts` (el patrón a seguir).

**Diseño** (nombres de métodos en español, mismo idioma que `CarritoService`):

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { PaqueteData } from '../../../shared/models/paquete-data';
import { calcularFechaFin, calcularTotal } from '../../../shared/util/fechas-precios';

const getId = (p: any): number => {
  const raw = p?.idPaquete ?? p?.paqueteId ?? p?.id ?? p?.id_paquete ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

@Injectable({ providedIn: 'root' })
export class InscripcionStore {
  private readonly listaPaquetesSig = signal<PaqueteData[]>([]);
  private readonly paqueteIdSig = signal<number>(0);
  private readonly descuentoSig = signal<number>(0);
  private readonly fechaInicioSig = signal<string>(new Date().toISOString().slice(0, 10));

  readonly listaPaquetes = computed(() => this.listaPaquetesSig());
  readonly paqueteId = computed(() => this.paqueteIdSig());
  readonly descuento = computed(() => this.descuentoSig());
  readonly fechaInicio = computed(() => this.fechaInicioSig());

  readonly paqueteActual = computed(() => {
    const pid = Number(this.paqueteIdSig() ?? 0);
    return (this.listaPaquetesSig() ?? []).find((p: any) => getId(p) === pid) ?? null;
  });

  readonly precioPaquete = computed(() => Number((this.paqueteActual() as any)?.precio ?? 0) || 0);

  readonly costoInscripcion = computed(
    () => Number((this.paqueteActual() as any)?.costoInscripcion ?? 0) || 0,
  );

  readonly totalVista = computed(() =>
    calcularTotal(this.precioPaquete(), this.descuentoSig() || 0, this.costoInscripcion()),
  );

  readonly totalSinDescuento = computed(() =>
    calcularTotal(this.precioPaquete(), 0, this.costoInscripcion()),
  );

  readonly fechaPagoVista = computed(() =>
    calcularFechaFin(String(this.fechaInicioSig() ?? ''), (this.paqueteActual() as any)?.tiempo ?? null),
  );

  establecerListaPaquetes(paquetes: PaqueteData[]): void {
    this.listaPaquetesSig.set(paquetes);
  }

  establecerPaqueteId(paqueteId: number): void {
    this.paqueteIdSig.set(paqueteId);
  }

  establecerDescuento(descuento: number): void {
    this.descuentoSig.set(descuento);
  }

  establecerFechaInicio(fechaInicio: string): void {
    this.fechaInicioSig.set(fechaInicio);
  }

  reiniciar(): void {
    this.listaPaquetesSig.set([]);
    this.paqueteIdSig.set(0);
    this.descuentoSig.set(0);
    this.fechaInicioSig.set(new Date().toISOString().slice(0, 10));
  }
}
```

⚠️ El implementador debe **verificar cada fórmula contra el archivo real ANTES de copiar** (este plan puede tener quedado desactualizado) — no confiar ciegamente en el boceto de arriba, es una guía, no la fuente de verdad.

- [ ] **Step 1:** Crear `inscripcion-store.ts`.
- [ ] **Step 2:** Portar `inscripcion-state.spec.ts` → `inscripcion-store.spec.ts`: mismos casos de prueba, mismos valores esperados (incluidos los casos que ejercitan `getId` con llaves alternativas, `calcularTotal`, `calcularFechaFin` con distintos `tiempo`), adaptados de "dispatch action + leer selector desde un store de prueba" a "llamar método + leer computed signal directamente sobre una instancia de `InscripcionStore`".
- [ ] **Step 3:** Gates: tsc app/spec, tests (492 + los nuevos), build.
- [ ] **Step 4:** Commit:

```bash
git add src/app/features/inscripciones/data/inscripcion-store.ts src/app/features/inscripciones/data/inscripcion-store.spec.ts
git commit -m "feat(): construir InscripcionStore con signals (reemplaza el store de NgRx)"
```
Verificar sin trailer. **NO borrar todavía** los archivos viejos de NgRx (`inscripcion-actions/reducer/selectors/models.ts`) — `inscripcion.ts` los sigue usando hasta la Task 3.

---

### Task 3: Migrar `inscripcion.ts` de NgRx a `InscripcionStore`

**Files:**
- `src/app/features/inscripciones/pages/inscripcion/inscripcion.ts`

Leer COMPLETO antes de tocar. Reemplazar:
- `import { Store } from '@ngrx/store'` + `import { InscripcionActions } from './state/inscripcion-actions'` + los imports de selectores → `import { InscripcionStore } from '../../data/inscripcion-store'`.
- `private store = inject(Store);` → `private store = inject(InscripcionStore);` (mismo nombre de propiedad `store` para minimizar el diff en los ~15 sitios que ya lo usan).
- `this.store.selectSignal(selectPaqueteActual)` → `this.store.paqueteActual` (ya es un signal, sin `selectSignal`). Igual para `selectFechaPagoVista` → `this.store.fechaPagoVista`, `selectPaqueteId` → `this.store.paqueteId`.
- `this.store.dispatch(InscripcionActions.setPaqueteId({ paqueteId: pid }))` → `this.store.establecerPaqueteId(pid)`. Igual patrón para `setFechaInicio`/`setDescuento`/`setListaPaquetes`/`reset()` → `establecerFechaInicio`/`establecerDescuento`/`establecerListaPaquetes`/`reiniciar()`.

Verificar los ~15 sitios de dispatch y los 3 de lectura uno por uno (grep `store\.` en el archivo real antes y después, confirmar que no queda ningún `.dispatch(` ni `InscripcionActions` ni `selectSignal`).

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): migrar inscripcion.ts de NgRx a InscripcionStore"
```
Verificar sin trailer.

---

### Task 4: Construir `ReinscripcionStore` (signals) + portar sus tests

**Files:**
- Create: `src/app/features/inscripciones/data/reinscripcion-store.ts`
- Create: `src/app/features/inscripciones/data/reinscripcion-store.spec.ts` (portado de `reinscripcion-state.spec.ts`)

Mismo procedimiento que Task 2, pero con las fórmulas DISTINTAS de `reinscripcion-selectors.ts` (tabla de arriba) — específicamente:
- `paqueteActual`: `Number(p.idPaquete) === Number(id)` directo, SIN el helper `getId` de múltiples llaves.
- `precioPaquete`: `Number(p?.precio ?? 0)`, SIN el `|| 0` extra.
- NO existe `costoInscripcion` en este store — no agregarlo, no es parte de esta oleada.
- `totalSinDescuento`: devuelve `precioPaquete()` tal cual, NO pasa por `calcularTotal`.
- `totalVista`: `Math.max(0, precioPaquete() - (descuento() || 0))` — NO usar `calcularTotal` aquí, es una fórmula distinta a propósito.
- `fechaPagoVista`: devuelve `fechaInicio()` tal cual — NO calcular fecha de fin, aunque el nombre lo sugiera. Documentar con un comentario que esto replica el comportamiento actual (posiblemente incorrecto) del selector original, y que corregirlo queda fuera de esta oleada.

⚠️ El implementador debe verificar `reinscripcion-selectors.ts`/`reinscripcion-reducer.ts`/`reinscripcion-actions.ts`/`reinscripcion-models.ts` reales antes de escribir nada — no asumir que son iguales a los de `inscripcion` más allá de lo ya documentado en este plan.

## Gates: completos.

## Commit

```bash
git add src/app/features/inscripciones/data/reinscripcion-store.ts src/app/features/inscripciones/data/reinscripcion-store.spec.ts
git commit -m "feat(): construir ReinscripcionStore con signals (reemplaza el store de NgRx, preserva sus formulas propias)"
```
Verificar sin trailer.

---

### Task 5: Migrar `reinscripcion.ts` de NgRx a `ReinscripcionStore`

**Files:**
- `src/app/features/inscripciones/pages/reinscripcion/reinscripcion.ts`

Mismo procedimiento que Task 3, pero con los 8 signals que este archivo lee (`listaPaquetesSig`, `paqueteActualSig`, `precioPaqueteSig`, `totalVistaSig`, `totalSinDescSig`, `fechaPagoVistaSig`, `descuentoSelSig`, `fechaInicioSelSig`, `paqueteIdSelSig`) y los ~5 sitios de dispatch. Verificar cada uno contra el archivo real.

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): migrar reinscripcion.ts de NgRx a ReinscripcionStore"
```
Verificar sin trailer.

---

### Task 6: Eliminar NgRx del proyecto

**Files:**
- Delete: `src/app/features/inscripciones/pages/inscripcion/state/` (carpeta completa: `inscripcion-actions.ts`, `inscripcion-reducer.ts`, `inscripcion-selectors.ts`, `inscripcion-models.ts`, `inscripcion-state.spec.ts`)
- Delete: `src/app/features/inscripciones/pages/reinscripcion/state/` (carpeta completa, análogo)
- `src/app/app.config.ts`
- `package.json` (+ `package-lock.json` vía `npm uninstall`)

Antes de borrar: `grep -rn "InscripcionActions\|ReinscripcionActions\|from '\.\./state\|from '\./state" src/app --include="*.ts"` → debe devolver SOLO los archivos que se están por borrar (si aparece algo más, ese archivo necesita actualizarse primero, no está cubierto por Tasks 3/5).

En `app.config.ts`: quitar `provideStore()`, `provideState(inscripcionFeature)`, `provideState(REINSCRIPCION_FEATURE_KEY, reinscripcionReducer)`, y sus imports (`provideStore`, `provideState` de `@ngrx/store`, `inscripcionFeature`, `REINSCRIPCION_FEATURE_KEY`, `reinscripcionReducer`).

En `package.json`: `npm uninstall @ngrx/store @ngrx/effects @ngrx/store-devtools` (no editar el JSON a mano — dejar que npm actualice `package-lock.json` correctamente).

Verificación final: `grep -rn "@ngrx" src/app --include="*.ts"` → vacío. `grep -n "@ngrx" package.json` → vacío.

## Gates: completos (además, confirmar que `npm install`/`npm uninstall` no rompió nada más — revisar `git diff package-lock.json` no debería tocar de más).

## Commit

```bash
git add -A
git commit -m "chore(): eliminar NgRx del proyecto (state/, wiring en app.config.ts, dependencias)"
```
Verificar sin trailer.

---

### Task 7: Verificación final de la oleada

- [ ] `npm run verificar` → todos los tests SUCCESS + build con las warnings conocidas.
- [ ] Smoke test manual del usuario (`npm run electron:prod`): flujo completo de **Inscripción** (buscar/seleccionar paquete, ver precio y fecha de fin calculada, aplicar descuento, capturar pago, confirmar e imprimir). Flujo completo de **Reinscripción** (mismo, prestando atención a que el campo de "fecha de pago vista" siga mostrando lo mismo que mostraba antes — aunque sea la fecha de inicio en vez de la fecha de fin calculada, eso es el comportamiento preexistente que esta oleada preserva a propósito). Confirmar que ambos flujos completan la inscripción/reinscripción y el ticket se imprime igual que antes.
- [ ] Reportar: total real de tests, confirmación de `grep -rn "@ngrx"` vacío en `src/app` y `package.json`, y el hallazgo documentado de `selectFechaPagoVista` de reinscripción (no calcula fecha de fin) como ítem de backlog para la oleada de `calculo-membresia-service`.

## Self-review (hecho al escribir el plan)

- **Cobertura:** cierra por completo el objetivo "salida de NgRx" del spec — las 3 dependencias (`store`/`effects`/`store-devtools`) quedan fuera del proyecto.
- **Riesgo:** el riesgo real no es técnico (el patrón de `CarritoService` ya está probado) sino de **preservación exacta de fórmulas** — por eso este plan documenta explícitamente las 6 diferencias entre los selectores de inscripción y reinscripción, para que ni el implementador ni el revisor las "corrijan" por accidente creyendo que es un bug a arreglar.
- **Fuera de alcance de 5a:** partir los componentes gigantes (`inscripcion.ts`/`reinscripcion.ts`/`reinscripcion-adelantada.ts`, todos siguen >1400 líneas después de esta oleada — el store nuevo no reduce el tamaño del componente por sí solo), `calculo-membresia-service` (consolidar/corregir la lógica de precios y promociones — incluye corregir el bug real de `fechaPagoVista` en reinscripción), partir `ticket-service.ts`. Todo eso son oleadas futuras de la Fase 5.
