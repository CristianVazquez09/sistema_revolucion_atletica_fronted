# Fase 1 — Limpieza de código muerto: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar todo el código, archivos, dependencias y configuración muerta del proyecto sin cambiar ningún comportamiento (Fase 1 del spec `docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`).

**Architecture:** Solo eliminaciones y correcciones de referencias muertas. Cada eliminación se verifica individualmente con `npm run build:web` antes de commitear; app en producción activa, cero tolerancia a romper. No se mueve ni renombra nada (eso es Fase 3).

**Tech Stack:** Angular 20 + Tailwind 4 (config CSS-first) + Electron. Build: `@angular/build`. La app usa DigitalPersona para huella (cadena: `src/assets/websdk/websdk.js` global → paquete falso `src/shims/WebSdk/` → `@digitalpersona/devices` parchado → `huella-reader-singleton`).

**Regla transversal:** si un build falla tras una eliminación, se restaura el archivo (`git checkout -- <ruta>`), se anota el hallazgo en el commit/PR y se continúa con la siguiente tarea. Nunca se fuerza.

---

### Task 1: Rama de trabajo y build de línea base

**Files:** ninguno (solo git y build)

- [ ] **Step 1: Crear rama**

```bash
git checkout -b chore/fase-1-limpieza
```

- [ ] **Step 2: Build de línea base**

Run: `npm run build:web`
Expected: `Application bundle generation complete` sin errores. Si la línea base ya falla, DETENTE y repórtalo — nada de esta fase puede verificarse sin build verde.

---

### Task 2: Carpeta vacía `pages/administration/` y hoja de estilos vacía `app.css`

**Files:**
- Delete: `src/app/pages/administration/` (carpeta sin archivos)
- Delete: `src/app/app.css` (0 líneas)
- Modify: `src/app/app.ts`

- [ ] **Step 1: Verificar que administration/ está vacía y borrarla**

```bash
find src/app/pages/administration -type f | wc -l   # Expected: 0
rm -rf src/app/pages/administration
```

- [ ] **Step 2: Borrar app.css y quitar su referencia + import sin uso en app.ts**

```bash
rm src/app/app.css
```

`src/app/app.ts` queda EXACTAMENTE así (se elimina `styleUrl` y el import de `RaAppZoomComponent`, que se importa pero no se usa en el arreglo `imports`):

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificacionHost } from './pages/notificacion-host/notificacion-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificacionHost],
  templateUrl: './app.html',
})
export class App {}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build:web`
Expected: éxito sin errores.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(): eliminar carpeta administration vacia, app.css vacio e import sin uso en app.ts"
```

---

### Task 3: Componente muerto `ra-app-zoom.ts`

Tras la Task 2 nadie importa `RaAppZoomComponent`. OJO: `ra-gimnasio-filter/` (subcarpeta) SÍ se usa en 5+ páginas — NO se toca.

**Files:**
- Delete: `src/app/shared/ra-app-zoom/ra-app-zoom.ts`
- Keep: `src/app/shared/ra-app-zoom/ra-gimnasio-filter/ra-gimnasio-filter.ts`

- [ ] **Step 1: Verificar que no quedan referencias**

```bash
grep -rn "RaAppZoom\|ra-app-zoom" src --include="*.ts" --include="*.html" | grep -v "ra-app-zoom/ra-gimnasio-filter" | grep -v "ra-app-zoom/ra-app-zoom.ts"
```

Expected: sin resultados (cero líneas). Si aparece algo, DETENTE y revisa antes de borrar.

- [ ] **Step 2: Borrar el componente**

```bash
rm src/app/shared/ra-app-zoom/ra-app-zoom.ts
```

- [ ] **Step 3: Verificar build**

Run: `npm run build:web`
Expected: éxito sin errores.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(): eliminar componente ra-app-zoom sin uso (se conserva ra-gimnasio-filter)"
```

---

### Task 4: Servicio muerto `fingerprint.service.ts`

El lector de huella real es `src/app/pages/huella-modal/huella-reader-singleton.ts` + `huella-modal.ts`. `FingerprintService` no lo importa nadie.

**Files:**
- Delete: `src/app/services/fingerprint.service.ts`

- [ ] **Step 1: Verificar que no hay consumidores**

```bash
grep -rn "FingerprintService\|fingerprint.service\|fingerprint\.service" src --include="*.ts" | grep -v "src/app/services/fingerprint.service.ts"
```

Expected: sin resultados. Si aparece algo, DETENTE.

- [ ] **Step 2: Borrar**

```bash
rm src/app/services/fingerprint.service.ts
```

- [ ] **Step 3: Verificar build**

Run: `npm run build:web`
Expected: éxito sin errores.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(): eliminar fingerprint.service muerto (el lector real es huella-reader-singleton)"
```

---

### Task 5: Dependencias npm sin uso

`chart.js`, `html2canvas`, `jspdf` y `heroicons` no se importan en ningún archivo (los íconos son SVG pegados en templates; las gráficas usan `echarts`).

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `package-lock.json` (regenerado por npm)

- [ ] **Step 1: Verificar que ninguna se importa**

```bash
grep -rn "chart.js\|from 'chart\|html2canvas\|jspdf\|from 'heroicons\|heroicons/" src electron --include="*.ts" --include="*.js" --include="*.html" | grep -v node_modules
```

Expected: sin resultados. Si alguna aparece, exclúyela del uninstall y repórtalo.

- [ ] **Step 2: Desinstalar**

```bash
npm uninstall chart.js html2canvas jspdf heroicons
```

Expected: package.json sin esas 4 entradas; `npm install` corre `postinstall` (patch-package) sin errores — verifica que la salida incluya `@digitalpersona+devices+0.2.6.patch` aplicado correctamente.

- [ ] **Step 3: Verificar build**

Run: `npm run build:web`
Expected: éxito sin errores.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(): quitar dependencias sin uso (chart.js, html2canvas, jspdf, heroicons)"
```

---

### Task 6: Config muerta de Vite y tercer shim `src/websdk.ts`

Angular CLI con `@angular/build` no lee `vite.config.ts`. Además su alias apunta a `src/websdk.ts`, que a su vez importa `./websdk-lib/index.js` — carpeta que NO existe. Nadie importa `src/websdk.ts`.

**Files:**
- Delete: `vite.config.ts`
- Delete: `src/websdk.ts`

- [ ] **Step 1: Verificar que nadie importa src/websdk.ts**

```bash
grep -rn "from './websdk'\|from '../websdk'\|src/websdk" src angular.json package.json --include="*.ts" --include="*.json" 2>/dev/null | grep -v "src/websdk.ts:" | grep -v "assets/websdk" | grep -v "shims/websdk"
```

Expected: sin resultados. (Las rutas `assets/websdk` y `shims/websdk` son otros archivos y se excluyen a propósito.)

- [ ] **Step 2: Borrar ambos**

```bash
rm vite.config.ts src/websdk.ts
```

- [ ] **Step 3: Verificar build**

Run: `npm run build:web`
Expected: éxito sin errores.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(): eliminar vite.config.ts (Angular no lo lee) y shim src/websdk.ts que apunta a carpeta inexistente"
```

---

### Task 7: Shim duplicado `src/shims/websdk.ts` y entrada `paths` de tsconfig

Quedan dos shims de WebSdk. El que funciona es el paquete falso `src/shims/WebSdk/` (instalado vía `"WebSdk": "file:src/shims/WebSdk"` en package.json; resuelve el `require('WebSdk')` del bundle UMD de `@digitalpersona/devices`). El shim `src/shims/websdk.ts` solo está mapeado en `paths` de `tsconfig.app.json`, y ningún `.ts` del proyecto importa el módulo `'WebSdk'`, así que ese mapeo no resuelve nada.

**Files:**
- Delete: `src/shims/websdk.ts`
- Modify: `tsconfig.app.json`
- Keep (NO tocar): `src/shims/WebSdk/` (carpeta completa), `src/assets/websdk/websdk.js`, `patches/`

- [ ] **Step 1: Verificar que ningún .ts importa el módulo 'WebSdk'**

```bash
grep -rn "from 'WebSdk'\|import 'WebSdk'\|require('WebSdk')" src --include="*.ts"
```

Expected: sin resultados.

- [ ] **Step 2: Quitar la entrada paths y borrar el shim**

`tsconfig.app.json` queda EXACTAMENTE así (se elimina el bloque `paths` completo; `baseUrl` ya no hace falta sin `paths`, se conserva por si algo más lo usa — NO lo borres):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "baseUrl": "./",
    "types": []
  },
  "include": [
    "src/**/*.ts","src/**/*d.ts", 
  ],
  "exclude": [
    "src/**/*.spec.ts"
  ]
}
```

```bash
rm src/shims/websdk.ts
```

- [ ] **Step 3: Verificar build**

Run: `npm run build:web`
Expected: éxito sin errores. **Si falla con algo relacionado a WebSdk:** restaura (`git checkout -- tsconfig.app.json src/shims/websdk.ts`), anota que el shim de tipos sí es necesario, y sáltate esta task (repórtalo al final).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(): eliminar shim duplicado src/shims/websdk.ts y su entrada paths en tsconfig.app.json"
```

---

### Task 8: `tailwind.config.ts` muerto y variables CSS rotas en `:root`

Tailwind 4 usa config CSS-first (`@theme` en `src/styles.css`); nadie referencia el `.ts` (no existe directiva `@config`). BONUS descubierto: el `:root` de styles.css usa `var(--color-brand-black)` y `var(--color-brand-bg)`, tokens que solo existían en el `.ts` que Tailwind ignora — es decir, hoy esas dos variables están **sin definir** en runtime. Se corrigen apuntando a los tokens reales `--color-ra-*` (mismos valores hex: `brand.black` #000000 = `ra-negro`, `brand.bg` #F5F7F9 = `ra-bg`).

**Files:**
- Delete: `tailwind.config.ts`
- Modify: `src/styles.css:179-183`

- [ ] **Step 1: Verificar que no hay @config ni imports del config**

```bash
grep -rn "@config" src --include="*.css"
grep -rn "tailwind.config" src angular.json package.json --include="*.ts" --include="*.json" 2>/dev/null | grep -v node_modules
```

Expected: ambos sin resultados.

- [ ] **Step 2: Corregir :root en styles.css**

En `src/styles.css`, reemplazar:

```css
/* Base global (déjalo si ya lo usabas; no toca nada del modal) */
:root {
  color: var(--color-brand-black);
  background: var(--color-brand-bg);
}
```

por:

```css
:root {
  color: var(--color-ra-negro);
  background: var(--color-ra-bg);
}
```

- [ ] **Step 3: Borrar el config**

```bash
rm tailwind.config.ts
```

- [ ] **Step 4: Verificar build y aspecto visual**

Run: `npm run build:web`
Expected: éxito. Luego `npm start` y revisar visualmente 2-3 pantallas (login, socios, punto de venta): el fondo general debe verse gris claro #F5F7F9 y el texto negro. Como las variables estaban indefinidas antes, el fondo del `:root` podría cambiar sutilmente — si algo se ve distinto A PEOR, reporta antes de commitear.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(): eliminar tailwind.config.ts (Tailwind 4 usa @theme) y corregir variables sin definir en :root"
```

---

### Task 9: Duplicados internos de `styles.css`

`styles.css` define dos veces `.pager-btn` y `.pager-btn--ghost` (líneas ~120-128 y ~157-168, la segunda más completa gana por cascada) y dos veces `.rcm-paylabel` (línea ~82 dentro de `@layer components` y línea ~195 fuera, la segunda gana). Se elimina la definición perdedora de cada par.

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Eliminar el primer bloque .pager-btn/.pager-btn--ghost**

En `src/styles.css`, eliminar EXACTAMENTE este bloque (el que está justo después del comentario `/* Paginador ... */` y ANTES del bloque `.pager{`):

```css
.pager-btn{
  height: 2.25rem; padding: 0 0.75rem;
  border-radius: 0.75rem; border: 1px solid transparent;
  font-size: .875rem; transition: .15s; user-select: none;
}
.pager-btn--ghost{
  background:#fff; border-color:#d1d5db; color: color-mix(in oklab, var(--color-ra-slate) 90%, black 0%);
}
.pager-btn--ghost:hover{ background:#f3f4f6; }
```

(Se conserva el segundo set, más abajo, que incluye además `.pager-btn--primary` y `:disabled`.)

- [ ] **Step 2: Eliminar el primer .rcm-paylabel**

Dentro de `@layer components`, eliminar la línea:

```css
  .rcm-paylabel { @apply block text-sm font-semibold mb-2 text-gray-800; }
```

(Se conserva el `.rcm-paylabel` posterior con `md:mb-3`.)

- [ ] **Step 3: Verificar build y visual**

Run: `npm run build:web`
Expected: éxito. Con `npm start`, verificar el paginador de la tabla de socios y el modal de resumen de compra: idénticos a antes.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "chore(): eliminar definiciones CSS duplicadas (pager-btn, rcm-paylabel)"
```

---

### Task 10: Barrido de imports sin uso y código comentado

Tarea de descubrimiento acotada. Reglas estrictas de qué tocar y qué no.

**Files:**
- Modify: múltiples `.ts` bajo `src/app` (solo eliminaciones)

- [ ] **Step 1: Listar símbolos sin uso con el compilador**

```bash
npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals 2>&1 | head -100
```

Expected: lista de errores `TS6133 '<X>' is declared but its value is never read.` Anota cada archivo:línea.

- [ ] **Step 2: Eliminar SOLO imports y variables locales sin uso**

Para cada `TS6133`: si es un import → eliminar el símbolo del import (o la línea entera si queda vacía). Si es variable local trivialmente muerta → eliminarla. **NO tocar:** parámetros de funciones, propiedades de clase (pueden usarse desde el template — verifica en el `.html` antes de borrar cualquier propiedad), ni nada que requiera reescribir lógica.

- [ ] **Step 3: Re-verificar con el compilador**

```bash
npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals 2>&1 | grep -c "TS6133"
```

Expected: `0` (o solo los casos legítimos documentados en Step 2 que decidiste no tocar).

- [ ] **Step 4: Eliminar código comentado y comentarios-changelog**

Localizar candidatos:

```bash
grep -rn "// ✅\|// 👈\|// 👇\|/\* ✅" src/app --include="*.ts" | head -40
```

Reglas: eliminar (a) bloques de código comentado (código real desactivado, no explicaciones), (b) comentarios-changelog con emojis (`// ✅ NUEVO:`, `// 👈 reemplaza...`) — conservando el texto SI además documenta algo vigente (ej. `// 👈 enum de tipo de paquete` se borra entero; un comentario que explica formato de fecha se conserva sin el emoji), (c) comentarios de ruta obsoleta en la primera línea de archivos (ej. `// src/app/model/socio.ts` en un archivo que vive en otra ruta). **NO eliminar** comentarios que explican POR QUÉ el código hace algo.

- [ ] **Step 5: Verificar build**

Run: `npm run build:web`
Expected: éxito sin errores.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(): barrido de imports sin uso, codigo comentado y comentarios-changelog"
```

---

### Task 11: Verificación final en Electron y línea base de tests

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Build completo + arranque en Electron**

```bash
npm run electron
```

Expected: la ventana de Electron abre y carga la app. Smoke test manual (el usuario o quien ejecute con acceso a la app): login → lista de socios (tabla + paginador) → punto de venta (categorías y carrito) → abrir modal de huella (debe abrir aunque no haya lector conectado) → estadísticas (gráficas echarts renderizan).

- [ ] **Step 2: Registrar línea base de tests (NO arreglar nada)**

```bash
npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -20
```

Expected: registrar el resultado tal cual (el único spec es `app.spec.ts` y puede fallar por ser el default de ng new desactualizado). **No se arregla en esta fase** — es insumo de la Fase 2. Anotar el resultado en la descripción del PR/merge.

- [ ] **Step 3: Diff final de la fase**

```bash
git log --oneline main..HEAD && git diff main --stat | tail -5
```

Expected: ~9 commits, solo eliminaciones y ediciones mínimas (app.ts, tsconfig.app.json, styles.css, package.json).

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 1):** dependencias sin uso ✓ (Task 5), administration/ ✓ (Task 2), app.css ✓ (Task 2), tailwind.config.ts ✓ (Task 8), barrido de imports/código comentado ✓ (Task 10), fingerprint.service ✓ (Task 4), vite.config.ts ✓ (Task 6), shim duplicado + tsconfig ✓ (Task 7), verificación build+Electron por eliminación ✓ (cada task). Extras descubiertos al planear, dentro del alcance de "código muerto": src/websdk.ts (Task 6), ra-app-zoom.ts (Task 3), duplicados de styles.css (Task 9), variables :root sin definir (Task 8).
- **Nota:** el README de la cadena de huella y `docs/ARQUITECTURA.md` NO van en esta fase (el spec los ubica en la reorganización, Fase 3+).
- **Placeholders:** ninguno; cada step tiene comando/código exacto y resultado esperado.
- **Consistencia:** las rutas y nombres citados fueron verificados contra el repo real en la sesión de planeación (2026-07-07).
