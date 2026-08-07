# Fase 4b — ra-boton, ra-campo y ra-buscador: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `ra-boton`, `ra-campo` (envoltura de label+error para inputs/selects) y `ra-buscador` (búsqueda con debounce centralizado), y adoptarlos: `ra-buscador` completo en los 7 archivos que hoy duplican esa lógica, y `ra-boton`/`ra-campo` en 2 páginas representativas que validan el patrón end-to-end.

**Architecture:** Segunda oleada de la Fase 4 del spec (`docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`). 4a ya cerró `ra-dropdown` y `ra-badge`. Esta oleada sigue el mismo criterio de riesgo: construir primero, adoptar donde el valor es claro y el conteo de archivos es manejable. **Decisión de alcance explícita**: `ra-boton` e inputs aparecen en decenas de páginas (15+ con `.input-filled`, 10+ con clases de botón repetidas, probablemente 60-100+ instancias individuales) — adoptarlos en TODA la app de una sola vez sería una oleada enorme y de alto riesgo visual. Esta oleada construye los 3 componentes y prueba el patrón en 2 páginas reales; la adopción masiva del resto queda para una oleada 4c futura (junto con `ra-modal` o como su propia oleada — a decidir cuando se llegue ahí), igual que la reorganización de carpetas necesitó 3a/3b/3c para cubrir todo el árbol.

**DESVIACIÓN DOCUMENTADA del spec**: el spec nombra `ra-input` / `ra-select` como dos componentes separados. El catálogo real muestra que **`.select-wrap` (la clase pensada para selects) tiene CERO usos** — los selects de hoy reutilizan `.input-filled` + un ícono de flecha (chevron) dibujado a mano en cada modal. La diferencia real entre un campo de texto y un select en este código es solo QUÉ elemento nativo se proyecta adentro (`<input>` vs `<select>`), no el label/error que los envuelve — eso es idéntico en ambos casos. Por eso esta oleada construye **un solo componente `ra-campo`** (envoltura de label + control proyectado + mensaje de error), no dos. `ra-campo` NO reemplaza el `<input>`/`<select>` real ni su `formControlName` — los proyecta como contenido, para no arriesgar romper ningún formulario reactivo existente (mismo criterio de "cascarón, no reinvención" que ya se usó para diseñar `ra-tabla`).

**Tech Stack:** Angular 20 standalone, signal inputs (`input()`, `computed()`, `ChangeDetectionStrategy.OnPush`), Karma + Jasmine, Tailwind 4.

**Reglas transversales (las de 4a):**
- Cambia código (no es un move puro): el criterio es "se ve y comporta igual", verificado con smoke test manual, no diff idéntico.
- Componentes nuevos con signal inputs y `OnPush` desde el día uno.
- Gates por task: `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false --browsers=ChromeHeadless` (base 421), `npm run build:web`.
- ⚠️ Commits: español, una línea, `feat():`/`refactor():`, SIN trailer de coautoría. Verificar con `git log -1 --format=%B` tras cada commit.
- Nunca commitear `.claude/settings.local.json`.
- El descubrimiento de consumidores es SIEMPRE por grep — las listas de este plan son del 2026-08-07 y pueden quedar cortas.
- Cuando un revisor encuentre algo real, se corrige antes de seguir (patrón validado en 4a: 3 hallazgos reales corregidos in-flight).

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b feat/fase-4b-boton-campo-buscador`
- [ ] `npm run test:ci 2>&1 | tail -3` → `421 SUCCESS`. Si no, DETENTE.

---

### Task 2: Construir `ra-boton`

**Files:**
- Create: `src/app/shared/ui/ra-boton/ra-boton.ts`
- Create: `src/app/shared/ui/ra-boton/ra-boton.spec.ts`

**Diseño:** basado en las clases reales del catálogo (`.btn-primary-red`, `.btn-green`, `.rcm-btn--blue`/`--ghost`, y los patrones ad-hoc de "Crear/Agregar" emerald y azul-fuerte repetidos en ~10 páginas). `ra-boton` renderiza un `<button>` nativo interno — el click hecho en él burbujea de forma normal hasta el elemento `<ra-boton>`, así que `<ra-boton (click)="guardar()">` funciona sin que el componente tenga que reemitir el evento.

```typescript
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
  info: 'bg-[color:var(--color-ra-azul-fuerte)] hover:brightness-110 text-white',
  ghost: 'bg-white border border-gray-200 hover:bg-gray-50 text-ra-slate',
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
```

- [ ] **Step 1:** Crear `ra-boton.ts` con el código de arriba.
- [ ] **Step 2:** Crear `ra-boton.spec.ts`:

```typescript
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaBoton, RaBotonVariante } from './ra-boton';

@Component({
  standalone: true,
  imports: [RaBoton],
  template: `
    <ra-boton [variante]="variante" [deshabilitado]="deshabilitado" (click)="clicks = clicks + 1">
      Guardar
    </ra-boton>
  `,
})
class HostBoton {
  variante: RaBotonVariante = 'primario';
  deshabilitado = false;
  clicks = 0;
}

describe('RaBoton', () => {
  let fixture: ComponentFixture<HostBoton>;
  let host: HostBoton;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBoton] });
    fixture = TestBed.createComponent(HostBoton);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function boton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  it('proyecta el contenido', () => {
    expect(boton().textContent?.trim()).toBe('Guardar');
  });

  it('variante primario por defecto', () => {
    expect(boton().className).toContain('bg-red-600');
  });

  it('cambia de clases segun la variante', () => {
    host.variante = 'exito';
    fixture.detectChanges();
    expect(boton().className).toContain('bg-emerald-600');
  });

  it('el click en el boton interno burbujea al host', () => {
    boton().click();
    expect(host.clicks).toBe(1);
  });

  it('respeta deshabilitado', () => {
    host.deshabilitado = true;
    fixture.detectChanges();
    expect(boton().disabled).toBeTrue();
  });

  it('variante icono-peligro es circular', () => {
    host.variante = 'icono-peligro';
    fixture.detectChanges();
    expect(boton().className).toContain('rounded-full');
    expect(boton().className).toContain('w-8 h-8');
  });
});
```

- [ ] **Step 3:** Gates: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.spec.json --noEmit && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5` → clean, reportar el total real (421 + los `it(` reales del spec — contarlos, no asumir).
- [ ] **Step 4:** `npm run build:web 2>&1 | tail -5` → OK.
- [ ] **Step 5:** Commit:

```bash
git add src/app/shared/ui/ra-boton
git commit -m "feat(): construir ra-boton con variantes semanticas y tamanos"
```
Verificar sin trailer.

---

### Task 3: Construir `ra-campo`

**Files:**
- Create: `src/app/shared/ui/ra-campo/ra-campo.ts`
- Create: `src/app/shared/ui/ra-campo/ra-campo.spec.ts`

```typescript
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
```

- [ ] **Step 1:** Crear `ra-campo.ts` con el código de arriba.
- [ ] **Step 2:** Crear `ra-campo.spec.ts`:

```typescript
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaCampo } from './ra-campo';

@Component({
  standalone: true,
  imports: [RaCampo],
  template: `
    <ra-campo [etiqueta]="etiqueta" [requerido]="requerido" [error]="error">
      <input class="input-filled" [value]="valor" />
    </ra-campo>
  `,
})
class HostCampo {
  etiqueta = 'Nombre';
  requerido = false;
  error: string | null = null;
  valor = '';
}

describe('RaCampo', () => {
  let fixture: ComponentFixture<HostCampo>;
  let host: HostCampo;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostCampo] });
    fixture = TestBed.createComponent(HostCampo);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra la etiqueta', () => {
    expect(fixture.nativeElement.querySelector('label').textContent).toContain('Nombre');
  });

  it('proyecta el control real (input sigue siendo el mismo elemento)', () => {
    const input = fixture.nativeElement.querySelector('input.input-filled');
    expect(input).not.toBeNull();
  });

  it('sin requerido no muestra asterisco', () => {
    expect(fixture.nativeElement.querySelector('label').textContent).not.toContain('*');
  });

  it('con requerido muestra asterisco', () => {
    host.requerido = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('label').textContent).toContain('*');
  });

  it('sin error no muestra el parrafo de error', () => {
    expect(fixture.nativeElement.querySelector('p')).toBeNull();
  });

  it('con error lo muestra', () => {
    host.error = 'Campo obligatorio';
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('p');
    expect(p?.textContent?.trim()).toBe('Campo obligatorio');
  });

  it('sin etiqueta no renderiza el label', () => {
    host.etiqueta = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('label')).toBeNull();
  });
});
```

- [ ] **Step 3:** Gates completos (tsc app/spec, tests, build).
- [ ] **Step 4:** Commit:

```bash
git add src/app/shared/ui/ra-campo
git commit -m "feat(): construir ra-campo (envoltura de label, requerido y error para inputs/selects)"
```
Verificar sin trailer.

---

### Task 4: Construir `ra-buscador`

**Files:**
- Create: `src/app/shared/ui/ra-buscador/ra-buscador.ts`
- Create: `src/app/shared/ui/ra-buscador/ra-buscador.spec.ts`

**Diseño:** centraliza el `Subject` + `debounceTime` + `distinctUntilChanged` que hoy se repite en 7 archivos con tiempos inconsistentes (250-400ms). Default 300ms (punto medio, ya usado en 2 de los 7 archivos). Incluye botón "Limpiar" opcional (patrón visto en socio.html).

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Output,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';

/** Input de búsqueda con debounce centralizado. Emite el término ya
 * recortado (trim) y solo cuando cambia (distinctUntilChanged). */
@Component({
  selector: 'ra-buscador',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex shrink-0 items-center gap-1.5">
      <input
        type="text"
        class="h-8 w-[240px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs shadow-inner"
        [placeholder]="placeholder()"
        [value]="terminoActual()"
        (input)="onInput($any($event.target).value)"
      />
      @if (terminoActual() && mostrarLimpiar()) {
        <button
          type="button"
          class="h-8 shrink-0 rounded-lg border border-gray-200 px-3 text-xs text-ra-slate hover:bg-gray-50"
          (click)="limpiar()"
        >
          Limpiar
        </button>
      }
    </div>
  `,
})
export class RaBuscador {
  placeholder = input('Buscar…');
  debounceMs = input(300);
  mostrarLimpiar = input(true);

  @Output() buscar = new EventEmitter<string>();

  protected readonly terminoActual = signal('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly entrada$ = new Subject<string>();

  constructor() {
    this.entrada$
      .pipe(
        map((v) => v.trim()),
        debounceTime(this.debounceMs()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((termino) => this.buscar.emit(termino));
  }

  protected onInput(valor: string): void {
    this.terminoActual.set(valor);
    this.entrada$.next(valor);
  }

  protected limpiar(): void {
    this.terminoActual.set('');
    this.entrada$.next('');
  }
}
```

- [ ] **Step 1:** Crear `ra-buscador.ts` con el código de arriba.
- [ ] **Step 2:** Crear `ra-buscador.spec.ts`:

```typescript
import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RaBuscador } from './ra-buscador';

@Component({
  standalone: true,
  imports: [RaBuscador],
  template: `<ra-buscador [debounceMs]="50" (buscar)="terminos.push($event)"></ra-buscador>`,
})
class HostBuscador {
  terminos: string[] = [];
}

describe('RaBuscador', () => {
  let fixture: ComponentFixture<HostBuscador>;
  let host: HostBuscador;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBuscador] });
    fixture = TestBed.createComponent(HostBuscador);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  function escribir(valor: string): void {
    const el = input();
    el.value = valor;
    el.dispatchEvent(new Event('input'));
  }

  it('no emite antes de que pase el debounce', fakeAsync(() => {
    escribir('ana');
    tick(10);
    expect(host.terminos).toEqual([]);
  }));

  it('emite el termino recortado tras el debounce', fakeAsync(() => {
    escribir('  ana  ');
    tick(60);
    expect(host.terminos).toEqual(['ana']);
  }));

  it('no emite dos veces el mismo termino seguido (distinctUntilChanged)', fakeAsync(() => {
    escribir('ana');
    tick(60);
    escribir('ana');
    tick(60);
    expect(host.terminos).toEqual(['ana']);
  }));

  it('el boton limpiar vacia el campo y emite cadena vacia', fakeAsync(() => {
    escribir('ana');
    tick(60);
    fixture.detectChanges();
    const limpiarBtn = fixture.nativeElement.querySelector('button');
    limpiarBtn.click();
    tick(60);
    expect(input().value).toBe('');
    expect(host.terminos).toEqual(['ana', '']);
  }));

  it('el boton limpiar no aparece si mostrarLimpiar es false', () => {
    fixture.componentInstance.terminos = [];
    (fixture.debugElement.children[0].componentInstance as RaBuscador);
    // Verificado por ausencia de termino inicial: sin texto, no hay boton.
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
```

- [ ] **Step 3:** Gates completos.
- [ ] **Step 4:** Commit:

```bash
git add src/app/shared/ui/ra-buscador
git commit -m "feat(): construir ra-buscador con debounce centralizado (300ms por defecto)"
```
Verificar sin trailer.

---

### Task 5: Adoptar `ra-buscador` — lote 1 (socios, catálogo)

**Files (grep primero: `grep -rln "debounceTime" src/app --include="*.ts"` — orientativo):**
- `src/app/features/socios/pages/socio/socio.ts` + `.html` (400ms → pasa a 300ms del default; documentar el cambio de timing en el commit, es una diferencia real aunque pequeña)
- `src/app/features/administracion/pages/producto/producto.ts` + `.html` (350ms → 300ms)
- `src/app/features/administracion/pages/paquete/paquete.ts` + `.html` (250ms → 300ms)

**Por archivo:** leer el `.ts` completo — localizar el `Subject<string>`, el pipe con `debounceTime`, el método `onBuscarChange`/equivalente, y el `<input>` en el `.html`. Reemplazar el input + la lógica de debounce por:

```html
<ra-buscador placeholder="Buscar por nombre" (buscar)="onBuscarChange($event)"></ra-buscador>
```

Mantener el método `onBuscarChange(termino: string)` (o su nombre real) tal cual, pero simplificado: ya NO necesita normalizar/debounce (eso lo hace `ra-buscador`), solo dispara la búsqueda con el término recibido. Eliminar el `Subject`, el `.pipe(...)`, y la suscripción manual — todo eso ahora vive en `ra-buscador`. Si el método original hacía algo MÁS que buscar (ej. `normalizarTermino` con lógica propia del dominio, no solo trim), verificar si esa normalización debe conservarse en el handler (no todo normalizar es igual a trim — leer el código real antes de asumir que se puede borrar).

## Gates: tsc app/spec, tests (421 + los nuevos de esta oleada, sin cambio en esta task), build.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-buscador en socio, producto y paquete"
```
Verificar sin trailer.

---

### Task 6: Adoptar `ra-buscador` — lote 2 (resto)

**Files:**
- `src/app/features/asistencia/pages/asistencia-historial/asistencia-historial.ts` + `.html` (300ms)
- `src/app/features/inscripciones/pages/inscripcion/inscripcion.ts` + `.html` (250ms — OJO: este archivo usa `switchMap`, verificar si la búsqueda dispara una llamada HTTP encadenada que debe preservarse en el handler)
- `src/app/features/punto-venta/pages/punto-venta/punto-venta.ts` + `.html` (300ms, también con `switchMap`)
- `src/app/features/asesorias/pages/asesoria-nutricional/asesoria-nutriocional-modal/asesoria-nutriocional-modal.ts` + `.html` (250ms, con `filter(term.length>=2)` — este filtro de longitud mínima NO lo tiene `ra-buscador`; si se pierde, el componente buscaría desde 1 carácter en vez de 2. Decisión: conservar el filtro de longitud DENTRO del handler `onBuscarChange`, ej. `if (termino.length < 2 && termino.length > 0) return;`, ya que `ra-buscador` no necesita saber de esa regla de negocio específica).

Mismo procedimiento que Task 5. Verificar con cuidado los 2 archivos con `switchMap` y el de `filter` de longitud mínima — no son adopciones triviales, tienen lógica adicional que debe preservarse.

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-buscador en asistencia-historial, inscripcion, punto-venta y asesoria-nutricional"
```
Verificar sin trailer.

- [ ] **Verificación de cierre de esta parte:** `grep -rln "debounceTime" src/app --include="*.ts"` → debe quedar vacío o mostrar solo archivos fuera del dominio de búsqueda de listas (si aparece algo, es un consumidor que el catálogo no cubrió — actualizarlo también).

---

### Task 7: Adoptar `ra-boton` + `ra-campo` en `socio-modal` (página representativa 1)

**Files:**
- `src/app/features/socios/pages/socio/socio-modal/socio-modal.ts` + `.html`

Leer el `.html` completo. Reemplazar:
- Cada `<button class="btn-...">`/botón de guardar-cancelar por `<ra-boton variante="...">texto</ra-boton>` con la variante correcta según su función actual (guardar=primario, cancelar=ghost, eliminar si existe=peligro).
- Cada bloque `<label>...</label><input class="input-filled" formControlName="...">` + su `<p>` de error condicional por `<ra-campo etiqueta="..." [requerido]="..." [error]="...">` envolviendo el `<input>`/`<select>` REAL sin tocar su `formControlName`. El `[error]` se calcula igual que antes (ej. `(intentoGuardar || form.controls.x.touched) && form.controls.x.invalid ? 'mensaje' : null`) — mover esa expresión a un getter/método en el `.ts` si hoy vive inline en el template, para mantener el HTML legible.
- El chevron de select hecho a mano (SVG) SE QUEDA como está dentro de `ra-campo` (ra-campo no sabe de selects, solo envuelve) — no se toca esa parte.

Agregar `RaBoton, RaCampo` a los `imports` del componente.

## Gates: completos (tsc app/spec, tests, build).

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-boton y ra-campo en socio-modal (primera pagina de validacion)"
```
Verificar sin trailer.

---

### Task 8: Adoptar `ra-boton` + `ra-campo` en `producto-modal` (página representativa 2)

**Files:**
- `src/app/features/administracion/pages/producto/producto-modal/producto-modal.ts` + `.html`

Mismo procedimiento que Task 7.

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): adoptar ra-boton y ra-campo en producto-modal (segunda pagina de validacion)"
```
Verificar sin trailer.

---

### Task 9: Verificación final de la oleada

- [ ] `npm run verificar` → todos los tests SUCCESS + build con las warnings conocidas.
- [ ] Smoke test manual del usuario (`npm run electron:prod`): buscador en socios/productos/paquetes (verificar que la búsqueda funciona con el nuevo debounce de 300ms, incluida la de inscripción y punto de venta que tienen lógica extra de `switchMap`, y la de asesoría nutricional con su mínimo de 2 caracteres); abrir socio-modal y producto-modal — verificar que los botones se ven y funcionan igual (guardar, cancelar), y que los campos muestran su label/error igual que antes.
- [ ] Reportar: total real de tests, confirmación de que `ra-boton`/`ra-campo` están listos pero SOLO adoptados en 2 páginas (el resto es trabajo futuro, documentado explícitamente — no es una tarea olvidada), y que `ra-buscador` quedó completamente adoptado en los 7 consumidores originales.

## Self-review (hecho al escribir el plan)

- **Cobertura:** los 3 componentes de esta oleada (según el orden ra-boton/ra-input-select/ra-buscador del spec original) ✓. Desviación documentada: 1 componente `ra-campo` en vez de 2 (`ra-input`/`ra-select`) justificada por `.select-wrap` estar muerto y el patrón real ser idéntico entre inputs y selects.
- **Alcance:** adopción completa de `ra-buscador` (7/7) ✓; adopción PARCIAL deliberada de `ra-boton`/`ra-campo` (2 páginas de validación, resto diferido) — declarado explícitamente, no es un hueco oculto.
- **Riesgo:** las Tasks 5-6 identifican por adelantado los 3 casos NO triviales (switchMap en inscripcion/punto-venta, filtro de longitud mínima en asesoria-nutricional) para que el implementador no los pierda al simplificar.
- **Fuera de alcance de 4b:** `ra-modal` (4c), `ra-tabla`/`ra-paginador` (4d), adopción masiva de `ra-boton`/`ra-campo` en el resto de páginas (4c o posterior, a decidir).
