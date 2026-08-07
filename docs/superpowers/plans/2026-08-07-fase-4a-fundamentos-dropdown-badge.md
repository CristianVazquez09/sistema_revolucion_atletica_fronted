# Fase 4a — Fundamentos, ra-dropdown y ra-badge: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar Prettier + `prettier-plugin-tailwindcss`, agregar tokens semánticos en `@theme`, y construir + adoptar `ra-dropdown` (elimina 12 copias del menú ⋮ de acciones) y `ra-badge` (unifica los pills de estado) en `shared/ui`.

**Architecture:** Primera de cuatro oleadas de la Fase 4 del spec (`docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`). Orden decidido con el dueño: 4a fundamentos + los 2 componentes de menor riesgo (extracción pura de comportamiento, sin ambigüedad visual) → 4b átomos de formulario/acción (`ra-boton`, `ra-input`/`ra-select`, `ra-buscador`) → 4c `ra-modal` (unificando los 2 patrones de apertura que conviven hoy) → 4d `ra-tabla`/`ra-paginador` (la de mayor superficie, 24 tablas). Catálogo completo de patrones actuales levantado el 2026-08-07.

**Tech Stack:** Angular 20 standalone con signal inputs (`input()`, `computed()`, `ChangeDetectionStrategy.OnPush` — mandato del spec, "mejoras adicionales" ítem 2), Karma + Jasmine, Tailwind 4.

**Reglas transversales — DIFERENTES a las Fases 1-3:**
- A diferencia de Fases 1-3 ("mover código, cero cambio de comportamiento"), esta fase SÍ cambia código: cada adopción borra la lógica duplicada de una página y la reemplaza por el componente compartido. El criterio de éxito no es "diff idéntico" sino **"la página se ve y se comporta igual para el usuario"**, verificado con smoke test manual.
- Cada componente nuevo se construye PRIMERO con su propio test (`*.spec.ts`), luego se adopta página por página en tasks separadas y agrupadas en lotes pequeños (2-5 páginas por commit) — nunca "un commit gigante que toca todo".
- Componentes nuevos usan **signal inputs** (`input()`) y `computed()`, no `@Input()` clásico — es código nuevo, se hace con el idioma moderno de Angular 20 desde el día uno.
- Gates por task: `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false --browsers=ChromeHeadless` (base 403), `npm run build:web`.
- Commits: español, una línea, `feat(): ...` para componentes nuevos o `refactor(): ...` para adopciones, SIN trailer de coautoría. Verificar con `git log -1 --format=%B` tras cada commit.
- Nunca commitear `.claude/settings.local.json`.
- El descubrimiento de consumidores es SIEMPRE por grep — las listas de este plan vienen del catálogo del 2026-08-07 y pueden quedar cortas.

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b feat/fase-4a-fundamentos-dropdown-badge`
- [ ] `npm run test:ci 2>&1 | tail -3` → `403 SUCCESS`. Si no, DETENTE.

---

### Task 2: Instalar Prettier + prettier-plugin-tailwindcss y formatear el repo

**Files:**
- Modify: `package.json` (deps + config)
- Modify: TODOS los `.ts`/`.html` del repo (solo formato, cero cambios semánticos)

- [ ] **Step 1: Instalar**

```bash
npm install -D prettier prettier-plugin-tailwindcss
```

- [ ] **Step 2: Configurar**

`package.json` ya tiene un bloque `"prettier"` colgante (sin efecto porque prettier no estaba instalado). Reemplazarlo por:

```json
  "prettier": {
    "plugins": ["prettier-plugin-tailwindcss"],
    "singleQuote": true,
    "printWidth": 100,
    "overrides": [
      {
        "files": "*.html",
        "options": { "parser": "angular" }
      }
    ]
  },
```

Agregar un script en `"scripts"`:

```json
    "format": "prettier --write \"src/**/*.{ts,html}\"",
```

- [ ] **Step 3: Formatear todo el repo en un solo paso**

```bash
npm run format
```

- [ ] **Step 4: Gates**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.spec.json --noEmit && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -3 && npm run build:web 2>&1 | tail -5`
Expected: los 3 comandos limpios, 403 SUCCESS, build OK con las warnings de presupuesto conocidas. Formatear NO debe cambiar ningún comportamiento — si algún test falla, es señal de que Prettier reordenó algo que no debía (revisar el diff del archivo específico, nunca forzar).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(): instalar prettier y prettier-plugin-tailwindcss, formatear el repo"
```
Verificar sin trailer (`git log -1 --format=%B`).

---

### Task 3: Tokens semánticos en `@theme`

**Files:**
- Modify: `src/styles.css`

Agregar (NO reemplazar los tokens de marca existentes — estos son alias aditivos, cero cambio visual porque nada los consume todavía):

```css
@theme {
  /* ...tokens de marca existentes sin tocar... */

  /* Tokens semánticos (Fase 4): desacoplan el SIGNIFICADO de un color de su
     valor físico. Hoy primario y peligro comparten el mismo rojo (ambigüedad
     heredada, documentada — no se resuelve en esta fase). */
  --color-primario: var(--color-ra-rojo);
  --color-primario-fuerte: var(--color-ra-rojo-fuerte);
  --color-peligro: var(--color-ra-rojo);
  --color-peligro-fuerte: var(--color-ra-rojo-fuerte);
  --color-exito: var(--color-ra-verde);
  --color-exito-fuerte: var(--color-ra-verde-2);
  --color-info: var(--color-ra-azul-fuerte);
  --color-neutral: var(--color-ra-slate);
}
```

- [ ] Agregar el bloque al final del `@theme` existente en `src/styles.css`.
- [ ] Gates: `npm run build:web 2>&1 | tail -5` → OK, mismas 2 warnings conocidas. Con `npm start`, verificar visualmente 2-3 pantallas: CERO cambio (los tokens nuevos no los usa nadie aún).
- [ ] Commit:

```bash
git add src/styles.css
git commit -m "feat(): agregar tokens semanticos en @theme (primario, peligro, exito, info, neutral)"
```
Verificar sin trailer.

---

### Task 4: Construir `ra-dropdown`

**Files:**
- Create: `src/app/shared/ui/ra-dropdown/ra-dropdown-registry.ts`
- Create: `src/app/shared/ui/ra-dropdown/ra-dropdown-registry.spec.ts`
- Create: `src/app/shared/ui/ra-dropdown/ra-dropdown.ts`
- Create: `src/app/shared/ui/ra-dropdown/ra-dropdown.spec.ts`

**Diseño:** hoy cada página guarda su propio `menuRowIdx: number | null` para saber qué fila tiene el menú abierto — funciona porque hay una sola tabla por página. `ra-dropdown` es un componente independiente por fila (uno por cada `@for`), así que "solo un menú abierto a la vez" ya no lo puede garantizar cada instancia por sí sola. Se resuelve con un servicio `RaDropdownRegistry` (singleton, `providedIn: 'root'`) que trackea CUÁL dropdown está abierto — al abrir uno, cierra cualquier otro. Es un registro global (no por tabla), lo cual es correcto: si algún día hay 2 tablas visibles a la vez, sigue habiendo un solo menú abierto en pantalla, que es el comportamiento esperado.

- [ ] **Step 1: `ra-dropdown-registry.ts`**

```typescript
import { Injectable, signal } from '@angular/core';

/** Trackea cuál ra-dropdown está abierto en toda la app (solo uno a la vez). */
@Injectable({ providedIn: 'root' })
export class RaDropdownRegistry {
  private readonly abiertoId = signal<symbol | null>(null);

  estaAbierto(id: symbol): boolean {
    return this.abiertoId() === id;
  }

  abrir(id: symbol): void {
    this.abiertoId.set(id);
  }

  cerrarTodos(): void {
    this.abiertoId.set(null);
  }
}
```

- [ ] **Step 2: `ra-dropdown-registry.spec.ts`**

```typescript
import { TestBed } from '@angular/core/testing';
import { RaDropdownRegistry } from './ra-dropdown-registry';

describe('RaDropdownRegistry', () => {
  let registry: RaDropdownRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(RaDropdownRegistry);
  });

  it('no tiene nada abierto al inicio', () => {
    expect(registry.estaAbierto(Symbol('x'))).toBeFalse();
  });

  it('abrir marca ese id como abierto', () => {
    const id = Symbol('a');
    registry.abrir(id);
    expect(registry.estaAbierto(id)).toBeTrue();
  });

  it('abrir uno cierra el anterior', () => {
    const idA = Symbol('a');
    const idB = Symbol('b');
    registry.abrir(idA);
    registry.abrir(idB);
    expect(registry.estaAbierto(idA)).toBeFalse();
    expect(registry.estaAbierto(idB)).toBeTrue();
  });

  it('cerrarTodos cierra el que estuviera abierto', () => {
    const id = Symbol('a');
    registry.abrir(id);
    registry.cerrarTodos();
    expect(registry.estaAbierto(id)).toBeFalse();
  });
});
```

- [ ] **Step 3: `ra-dropdown.ts`**

Puerto 1:1 del cálculo de posición existente en `usuarios-admin.ts`/`membresia.ts`/etc. (`menuHeight = 130`, `gap = 4`), con el ícono de 3 puntos horizontal ya incluido (idéntico en las 12 páginas consumidoras) y los ítems del menú proyectados como contenido:

```typescript
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

  @ViewChild('trigger', { static: true }) private triggerRef!: ElementRef<HTMLButtonElement>;

  protected readonly registry = inject(RaDropdownRegistry);
  private readonly id = Symbol('ra-dropdown');
  private readonly menuHeight = 130;
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
    const openUp = spaceBelow < this.menuHeight + this.gap;
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
```

- [ ] **Step 4: `ra-dropdown.spec.ts`**

```typescript
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaDropdown } from './ra-dropdown';

@Component({
  standalone: true,
  imports: [RaDropdown],
  template: `
    <ra-dropdown>
      <button class="item-a">A</button>
    </ra-dropdown>
    <ra-dropdown>
      <button class="item-b">B</button>
    </ra-dropdown>
  `,
})
class HostDosDropdowns {}

describe('RaDropdown', () => {
  let fixture: ComponentFixture<HostDosDropdowns>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostDosDropdowns] });
    fixture = TestBed.createComponent(HostDosDropdowns);
    fixture.detectChanges();
  });

  function botones(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button[title]'));
  }

  function panelesAbiertos(): number {
    return fixture.nativeElement.querySelectorAll('.item-a, .item-b').length === 0
      ? 0
      : fixture.nativeElement.querySelectorAll('div.fixed').length;
  }

  it('abre el menu al hacer click en el boton', () => {
    botones()[0].click();
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(1);
  });

  it('abrir el segundo cierra el primero (solo uno a la vez)', () => {
    botones()[0].click();
    fixture.detectChanges();
    botones()[1].click();
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(1);
    expect(fixture.nativeElement.querySelector('.item-b')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.item-a')).toBeNull();
  });

  it('click de nuevo en el mismo boton lo cierra', () => {
    botones()[0].click();
    fixture.detectChanges();
    botones()[0].click();
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(0);
  });

  it('click en document cierra el abierto', () => {
    botones()[0].click();
    fixture.detectChanges();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(0);
  });
});
```

- [ ] **Step 5: Gates**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.spec.json --noEmit && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: 403 + 9 nuevos (5 registry + 4 dropdown) = `412 SUCCESS`. Ajustar si el conteo real difiere — reportar el total real.

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/ui/ra-dropdown
git commit -m "feat(): construir ra-dropdown con registro global de un solo menu abierto"
```
Verificar sin trailer.

---

### Task 5: Adoptar ra-dropdown — lote 1 (socios, asesorías, corte-caja)

**Files a modificar (grep primero: `grep -rln "toggleMenuRow\|menuDropdownStyle" src/app --include="*.ts"` — esta lista es orientativa):**
- `src/app/features/socios/pages/socio/socio.ts` + `.html`
- `src/app/features/asesorias/pages/entrenador/entrenador.ts` + `.html`
- `src/app/features/asesorias/pages/asesoria-nutricional/asesoria-nutricional.ts` + `.html`
- `src/app/features/administracion/pages/administracion/corte-caja-admin/corte-caja-admin.ts` + `.html`

**Por cada archivo `.ts`:** eliminar `menuRowIdx`, `menuDropUpIdx`, `menuDropdownStyle`, el método `toggleMenuRow()`, el método `closeMenuRows()` y su `@HostListener('document:click')` — todo ese comportamiento ahora vive en `RaDropdown`. Agregar `RaDropdown` al arreglo `imports` del `@Component`.

**Por cada archivo `.html`:** reemplazar el bloque completo (botón de 3 puntos + `@if (menuRowIdx === i) { <div class="fixed" [ngStyle]="menuDropdownStyle">...</div> }`) por:

```html
<ra-dropdown>
  <button (click)="editar(u)" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ra-bg">
    Editar
  </button>
  <button (click)="eliminar(u)" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ra-bg">
    Eliminar
  </button>
</ra-dropdown>
```

(Ajustar los botones EXACTOS por archivo — leer el `.html` original antes de tocar: `socio.html` tiene 4 opciones (Historial, Asesorías, Editar, Eliminar con role-gate), no solo 2. Copiar cada botón interno TAL CUAL estaba —texto, `(click)`, `*ngIf`/`@if` de rol— quitando únicamente el `menuRowIdx = null;` que antes iba antes de la acción, ya que `ra-dropdown` cierra el panel solo al hacer click en cualquier parte de él.)

- [ ] Actualizar los 4 pares de archivos (leer cada `.html` completo antes de editar).
- [ ] Gates: tsc app/spec, test:ci (mismo total del Task 4), build.
- [ ] Commit:

```bash
git add -A
git commit -m "refactor(): adoptar ra-dropdown en socios, entrenador, asesoria-nutricional y corte-caja-admin"
```
Verificar sin trailer.

---

### Task 6: Adoptar ra-dropdown — lote 2 (catálogo administración)

**Files (grep, orientativo):**
- `src/app/features/administracion/pages/producto/producto.ts` + `.html`
- `src/app/features/administracion/pages/paquete/paquete.ts` + `.html`
- `src/app/features/administracion/pages/categoria/categoria.ts` + `.html`
- `src/app/features/administracion/pages/administracion/promociones/promociones.ts` + `.html`

Mismo procedimiento que Task 5: leer cada `.html` original, portar los botones reales de cada menú (verificar textos/acciones — `promociones.html` tiene Editar + Activar/Desactivar, no Eliminar).

- [ ] Actualizar los 4 pares de archivos.
- [ ] Gates completos.
- [ ] Commit:

```bash
git add -A
git commit -m "refactor(): adoptar ra-dropdown en producto, paquete, categoria y promociones"
```
Verificar sin trailer.

---

### Task 7: Adoptar ra-dropdown — lote 3 (ventas, usuarios, membresía)

**Files (grep, orientativo):**
- `src/app/features/administracion/pages/administracion/ventas-admin/ventas-admin.ts` + `.html`
- `src/app/features/administracion/pages/administracion/ventas-admin/ventas-admin-modal/ventas-admin-modal.ts` + `.html`
- `src/app/features/administracion/pages/administracion/usuarios-admin/usuarios-admin.ts` + `.html`
- `src/app/features/administracion/pages/administracion/membresia/membresia.ts` + `.html`

`usuarios-admin.html` según el catálogo tiene una segunda variante de dropdown con el mismo mecanismo (`menuDropdownStyle` con top/bottom) — es el MISMO patrón, se adopta igual.

- [ ] Actualizar los 4 pares de archivos.
- [ ] Confirmar con grep que no queda ningún `toggleMenuRow`/`menuDropdownStyle` en el repo: `grep -rln "toggleMenuRow\|menuDropdownStyle" src/app --include="*.ts"` → vacío. Si algo aparece, es un consumidor que el catálogo no listó — actualizarlo también antes de cerrar el task.
- [ ] Gates completos.
- [ ] Commit:

```bash
git add -A
git commit -m "refactor(): adoptar ra-dropdown en ventas-admin, ventas-admin-modal, usuarios-admin y membresia"
```
Verificar sin trailer.

---

### Task 8: Construir `ra-badge`

**Files:**
- Create: `src/app/shared/ui/ra-badge/ra-badge.ts`
- Create: `src/app/shared/ui/ra-badge/ra-badge.spec.ts`

- [ ] **Step 1: `ra-badge.ts`**

```typescript
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
```

- [ ] **Step 2: `ra-badge.spec.ts`**

```typescript
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaBadge, RaBadgeVariante } from './ra-badge';

@Component({
  standalone: true,
  imports: [RaBadge],
  template: `<ra-badge [variante]="variante">{{ texto }}</ra-badge>`,
})
class HostBadge {
  variante: RaBadgeVariante = 'neutral';
  texto = 'Activo';
}

describe('RaBadge', () => {
  let fixture: ComponentFixture<HostBadge>;
  let host: HostBadge;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostBadge] });
    fixture = TestBed.createComponent(HostBadge);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function span(): HTMLSpanElement {
    return fixture.nativeElement.querySelector('span');
  }

  it('proyecta el contenido', () => {
    expect(span().textContent?.trim()).toBe('Activo');
  });

  it('variante neutral por defecto', () => {
    expect(span().className).toContain('bg-gray-100');
  });

  it('cambia de clases segun la variante', () => {
    host.variante = 'peligro';
    fixture.detectChanges();
    expect(span().className).toContain('bg-rose-100');
  });

  it('variante chip usa el token de marca', () => {
    host.variante = 'chip';
    fixture.detectChanges();
    expect(span().className).toContain('--color-ra-azul-fuerte');
  });
});
```

- [ ] **Step 3: Gates**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.spec.json --noEmit && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: total anterior + 4 nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/ui/ra-badge
git commit -m "feat(): construir ra-badge con variantes de estado y chip informativo"
```
Verificar sin trailer.

---

### Task 9: Adoptar ra-badge — lote 1 (socios, usuarios, membresía)

**Files (grep `rounded-full.*bg-.*text-` en `.html`, orientativo):**
- `src/app/features/socios/pages/socio/socio.html` (género: Femenino/Masculino/otro)
- `src/app/features/administracion/pages/administracion/usuarios-admin/usuarios-admin.html` (activo Sí/No + rol)
- `src/app/features/administracion/pages/administracion/membresia/membresia.html` (movimiento INSCRIPCION/REINSCRIPCION/otro + chip de gimnasio)

Reemplazar cada `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-X text-Y">...</span>` por `<ra-badge variante="...">...</ra-badge>` con la variante que corresponda según la tabla de mapeo del catálogo (ej. género femenino → no hay variante exacta "rosa"; usar `info` o dejar ese caso puntual sin badge si no encaja — decisión del implementador, documentar en el commit si se omite algún caso). Agregar `RaBadge` a los `imports` del componente.

- [ ] Actualizar los 3 archivos (agregar import en el `.ts`, reemplazar markup en el `.html`).
- [ ] Gates completos + revisión visual rápida con `npm start` de las 3 pantallas (los colores deben verse IGUAL, son los mismos valores solo que ahora vía componente).
- [ ] Commit:

```bash
git add -A
git commit -m "refactor(): adoptar ra-badge en socio, usuarios-admin y membresia"
```
Verificar sin trailer.

---

### Task 10: Adoptar ra-badge — lote 2 (promociones, corte-caja)

**Files:**
- `src/app/features/administracion/pages/administracion/promociones/promociones.ts` + `.html` (tipo + estado — hoy son funciones `tipoBadge()`/`estadoLabel()` en el `.ts`, se simplifican para devolver solo la variante + el texto, dejando las clases a `ra-badge`)
- `src/app/features/administracion/pages/administracion/corte-caja-admin/corte-caja-admin.html` (ABIERTO/CERRADO)
- `src/app/features/corte-caja/pages/corte-caja/corte-caja.html` (ABIERTO/CERRADO)

- [ ] Actualizar los 3 archivos. En `promociones.ts`, las funciones `tipoBadge()`/`estadoLabel()` pasan a devolver `{ variante: RaBadgeVariante, texto: string }` en vez de una cadena de clases CSS.
- [ ] Gates completos + revisión visual.
- [ ] Commit:

```bash
git add -A
git commit -m "refactor(): adoptar ra-badge en promociones y estado de corte de caja"
```
Verificar sin trailer.

---

### Task 11: Verificación final de la oleada

- [ ] `npm run verificar` → todos los tests SUCCESS + build con las 2 warnings conocidas (o menos, si algún chunk cambió de tamaño).
- [ ] `grep -rln "toggleMenuRow\|menuDropdownStyle\|menuRowIdx" src/app --include="*.ts"` → vacío (confirma que Tasks 5-7 cubrieron TODOS los consumidores reales, no solo la lista orientativa).
- [ ] Smoke test manual del usuario (`npm run electron:prod`): abrir el menú ⋮ en al menos 3 tablas distintas (socios, usuarios-admin, promociones) — debe verse y comportarse igual que antes (posición correcta cerca del borde de la pantalla, se cierra al hacer click afuera, solo un menú abierto a la vez incluso si se hace click rápido en dos filas distintas); revisar los badges de estado en las mismas 3 pantallas.
- [ ] Reportar: total real de tests, lista de páginas que NO se tocaron pero el grep del catálogo original mencionaba (si las hay), confirmación de que Fase 4a queda cerrada y lista para continuar con 4b (`ra-boton`, `ra-input`/`ra-select`, `ra-buscador`).

## Self-review (hecho al escribir el plan)

- **Cobertura:** las 3 decisiones de diseño confirmadas con el dueño (empezar por ra-dropdown, ra-tabla como cascarón para 4d, ra-modal con backdrop propio para 4c) quedan reflejadas en el orden de esta oleada y en las notas de arquitectura. Prettier + tokens semánticos (mandato explícito del spec para Fase 4) ✓ Tasks 2-3.
- **Placeholders:** código completo de los 2 componentes y sus 3 specs incluido; las adopciones dan el patrón exacto de reemplazo con la instrucción explícita de leer cada `.html` real antes de tocarlo (los menús no son idénticos entre páginas).
- **Riesgo:** el registro global de `ra-dropdown` es una mejora deliberada sobre el comportamiento actual (antes cada tabla no sabía de las demás; ahora la invariante "un solo menú abierto" es real en toda la app) — documentado en el diseño del Task 4 para que el revisor no lo confunda con un error.
- **Fuera de alcance de 4a:** `ra-boton`, `ra-input`/`ra-select`, `ra-buscador` (4b); `ra-modal` (4c); `ra-tabla`/`ra-paginador` (4d) — se planean por separado una vez cerrada esta oleada.
