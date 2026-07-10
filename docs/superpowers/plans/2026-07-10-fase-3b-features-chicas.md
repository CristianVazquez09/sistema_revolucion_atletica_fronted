# Fase 3b — Migración de features chicas: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear `features/` y migrar las features chicas (inventario, corte-caja, asesorías, asistencia, punto-venta) con lazy loading, más los componentes cross-feature que el grafo de imports demostró que son compartidos (huella, ticket, resúmenes) — y eliminar el `TicketService` huérfano (hallazgo 3, pedido del dueño).

**Architecture:** Segunda oleada de la Fase 3 del spec. 3a dejó `core/` y `shared/` listos. 3b mueve features chicas; 3c moverá las grandes (socios, inscripciones, administración, cuenta) + `docs/ARQUITECTURA.md`. Estructura por feature: `features/<f>/pages/<página>/`, `features/<f>/data/<servicios>`, `features/<f>/models/<modelos propios>`. Cada feature expone `<f>.routes.ts` y `pages.routes.ts` la consume con `loadChildren` (lazy).

**Tech Stack:** Angular 20 standalone, git mv, gates: tsc (app+spec) + 403 tests + build por task.

**Reglas transversales (las de 3a):**
- Solo `git mv` + imports + rutas. La ÚNICA excepción de lógica: las entradas de rutas pasan de eager a `loadChildren` (mandato del spec; cambia el chunking, no la semántica).
- Specs viajan con su fuente. Gates completos antes de cada commit. Commits `refactor(): ...` (la Task 10 usa `chore():` por ser eliminación), una línea, sin trailer. Nunca `.claude/settings.local.json`.
- Descubrimiento de consumidores SIEMPRE por grep; las listas de este plan salen del grafo de imports del 2026-07-09 y pueden quedar cortas.
- Los hallazgos de wiring NO se tocan (provideHttpClient duplicado, ruta membresia auto-redirect) — siguen siendo decisión del dueño.

**DESVIACIONES DEL SPEC, DELIBERADAS Y DOCUMENTADAS** (el grafo de imports manda):
1. El spec ubicaba huella en `features/asistencia/huella/`, pero huella-modal lo importan 7 consumidores de 5 features distintas → va a `shared/huella/` (con el README de la cadena huella que pide el spec).
2. El spec ubicaba ticket y resúmenes bajo `features/punto-venta/`, pero ticket-service lo usan 11 páginas de 6 features, resumen-compra lo usan 4 páginas de inscripciones, y resumen-venta lo usan asesorías y punto-venta → `shared/ticket/` y `shared/ui/`.
3. `corte-caja-data` y `usuario-data` pasan a `shared/models/` (los usan 2 features: corte-caja/administración y membresía-shared/administración respectivamente — la regla "2+ features = shared" del propio spec).

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b refactor/fase-3b-features-chicas`
- [ ] `npm run test:ci 2>&1 | tail -3` → `403 SUCCESS`. Si no, DETENTE.

---

### Task 2: Reclasificar `usuario-data` a shared/models (arregla inversión de capas de 3a)

`shared/models/membresia-data.ts` importa `UsuarioData` desde `../../model/usuario-data` (shared dependiendo de feature-owned — invertido). `usuario-data` lo usan membresia-data (shared) + usuarios-admin + usuario-service → es shared.

- [ ] `git mv src/app/model/usuario-data.ts src/app/shared/models/usuario-data.ts`
- [ ] Actualizar consumidores (`grep -rn "model/usuario-data" src --include="*.ts"`): membresia-data (queda `./usuario-data`), usuario-service, usuarios-admin(+modal), venta-data si aplica
- [ ] Gates: tsc app+spec, test:ci 403, build
- [ ] `git add -A && git commit -m "refactor(): reclasificar usuario-data a shared/models (lo comparten membresia y administracion)"`

---

### Task 3: `features/inventario/`

**Moves:**
- `src/app/pages/inventario/` (página completa) → `src/app/features/inventario/pages/inventario/`
- `src/app/services/inventario-service.ts` + `.spec.ts` → `src/app/features/inventario/data/`
- `src/app/model/inventario-diario-data.ts` → `src/app/features/inventario/models/`

**Rutas:** crear `src/app/features/inventario/inventario.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/inventario/inventario').then(m => m.Inventario),
  },
];
```

(VERIFICAR el nombre exportado real de la clase del componente en el fuente.) En `pages.routes.ts`: quitar el import eager de Inventario y reemplazar la entrada por:

```typescript
{ path: 'inventario', loadChildren: () => import('../features/inventario/inventario.routes').then(m => m.INVENTARIO_ROUTES) },
```

- [ ] Moves + rutas + imports (grep: `inventario-service`, `inventario-diario-data`, `pages/inventario`)
- [ ] Gates completos (tsc app+spec, 403, build — el build mostrará un chunk lazy nuevo para inventario: esperado)
- [ ] `git add -A && git commit -m "refactor(): migrar feature inventario a features/ con lazy loading"`

---

### Task 4: `features/corte-caja/` (+ reclasificación de su modelo)

**Moves:**
- `src/app/pages/corte-caja/` (página + corte-caja-modal + corte-caja-info si existe ahí) → `src/app/features/corte-caja/pages/corte-caja/` (subcarpetas internas se conservan)
- `src/app/services/corte-caja-service.ts` + `.spec.ts` → `src/app/features/corte-caja/data/`
- `src/app/model/corte-caja-data.ts` → `src/app/shared/models/corte-caja-data.ts` (RECLASIFICACIÓN: lo usan corte-caja Y administración/corte-caja-admin)

**Rutas:** `features/corte-caja/corte-caja.routes.ts` con `path: ''` → loadComponent CorteCaja; en pages.routes.ts la entrada `corte-caja` pasa a loadChildren.

- [ ] Moves + rutas + imports (grep: `corte-caja-service`, `corte-caja-data`, `pages/corte-caja` — OJO: corte-caja-admin en administración también importa el service y el model; sus imports se actualizan pero la página admin NO se mueve, va en 3c)
- [ ] Gates completos
- [ ] `git add -A && git commit -m "refactor(): migrar feature corte-caja a features/ y reclasificar su modelo a shared"`

---

### Task 5: `features/asesorias/`

**Moves (el spec agrupa asesoria + asesoria-nutricional + entrenador en una feature):**
- `src/app/pages/asesoria/` → `src/app/features/asesorias/pages/asesoria/`
- `src/app/pages/asesoria-nutricional/` (+ su modal) → `src/app/features/asesorias/pages/asesoria-nutricional/`
- `src/app/pages/entrenador/` (+ entrenador-modal + entrenador-info-asesoria) → `src/app/features/asesorias/pages/entrenador/`
- `src/app/services/asesoria-service.ts` + `.spec.ts`, `asesoria-nutricional-service.ts` + `.spec.ts`, `entrenador-service.ts` + `.spec.ts` → `src/app/features/asesorias/data/`
- `src/app/model/asesoria-data.ts`, `asesoria-nutricional-data.ts` → `src/app/features/asesorias/models/`

**Rutas:** `asesorias.routes.ts` con las entradas actuales de pages.routes: `entrenador`, `asesoria`, `entrenador/:idEntrenador/asesorias` (VERIFICAR rutas exactas y a qué feature pertenece cada path — `socio/:id/asesorias` es página de socio, NO se mueve). La entrada admin `asesorias-nutricionales` (bajo `admin/`) se queda en pages.routes pero su loadComponent apunta a la nueva ubicación. En pages.routes.ts: las entradas movidas se agrupan en UN loadChildren con prefijo vacío o se mapean 1:1 — decisión del implementador manteniendo los paths URL EXACTAMENTE iguales (los usuarios tienen bookmarks/hábitos; cero cambios de URL).

- [ ] Moves + rutas (URLs idénticas) + imports (grep amplio por cada archivo movido; consumidores cross-feature: inscripcion/reinscripcion importan entrenador-data — ya está en shared; socio-info-asesoria importa asesoria-contrato-data — shared)
- [ ] Gates completos
- [ ] `git add -A && git commit -m "refactor(): migrar feature asesorias (asesoria, nutricional, entrenador) a features/"`

---

### Task 6: `shared/huella/` (desviación documentada #1)

**Moves:**
- `src/app/pages/huella-modal/huella-modal.ts` (+ html/css si existen) → `src/app/shared/huella/huella-modal/`
- `src/app/pages/huella-modal/huella-reader-singleton.ts` → `src/app/shared/huella/huella-reader-singleton.ts`

**Crear `src/app/shared/huella/README.md`** (lo pide el spec) con el mapa de la cadena:

```markdown
# Huella digital (DigitalPersona)

Cadena completa de la integración:

1. `src/assets/websdk/websdk.js` — SDK real de HID/DigitalPersona, cargado como
   script global vía `angular.json` ("scripts"). Define `window.WebSdk`.
2. `src/shims/WebSdk/` — paquete npm falso (`"WebSdk": "file:src/shims/WebSdk"` en
   package.json). Resuelve el `require('WebSdk')` del bundle UMD de
   `@digitalpersona/devices` reexportando el global.
3. `@digitalpersona/devices` — parchado vía patch-package
   (`patches/@digitalpersona+devices+0.2.6.patch`). NO quitar el patch.
4. `huella-reader-singleton.ts` — UNA sola instancia de FingerprintReader por
   proceso (evita sockets duplicados contra el agente local).
5. `huella-modal/` — UI de captura; la usan inscripción, reinscripción,
   agregar-membresía, asesoría, asistencia y socio-modal.

El agente de DigitalPersona corre local (ver FINGERPRINT_CAPTURE_URL en environments).
Si la huella "no funciona": primero verificar que el agente local está corriendo,
luego esta cadena EN ESTE ORDEN.
```

**Rutas:** pages.routes tiene `huella` → loadComponent HuellaModal: actualizar la ruta del import a la nueva ubicación (sigue lazy).

- [ ] Moves + README + imports (7 consumidores: agregar-membresia, asesoria, asistencia, socio-modal, inscripcion, reinscripcion-adelantada, reinscripcion + pages.routes)
- [ ] Gates completos
- [ ] `git add -A && git commit -m "refactor(): mover huella a shared/huella con README de la cadena DigitalPersona"`

---

### Task 7: `features/asistencia/`

**Moves:**
- `src/app/pages/asistencia/` (incluye asistencia-store.ts) → `src/app/features/asistencia/pages/asistencia/`
- `src/app/pages/inscripcion/asistencia-historial/` → `src/app/features/asistencia/pages/asistencia-historial/` (es la página del path `historial-asistencias`; vive bajo inscripcion/ por accidente histórico — pertenece a asistencia)
- `src/app/services/check-in-service.ts` + `.spec.ts` → `src/app/features/asistencia/data/`
- `src/app/model/asistencia-historial-data.ts` → `src/app/features/asistencia/models/`

**Rutas:** `asistencia.routes.ts` con `asistencia` y `historial-asistencias` (URLs idénticas); pages.routes.ts las delega con loadChildren (mismo criterio de Task 5: paths URL exactos).

- [ ] Moves + rutas + imports (grep: `check-in-service`, `asistencia-historial`, `pages/asistencia`)
- [ ] Gates completos
- [ ] `git add -A && git commit -m "refactor(): migrar feature asistencia (checkin, historial) a features/"`

---

### Task 8: `shared/ticket/` y resúmenes a `shared/ui/` (desviación documentada #2)

**Moves:**
- `src/app/services/ticket-service.ts` + `.spec.ts` → `src/app/shared/ticket/` (11 consumidores en 6 features; además arregla otra inversión: `shared/util/ticket-contexto.ts` importa `VentaContexto` de él)
- `src/app/pages/resumen-compra/` → `src/app/shared/ui/resumen-compra/` (lo usan inscripcion, reinscripcion, adelantada, agregar-membresia)
- `src/app/pages/resumen-venta/` → `src/app/shared/ui/resumen-venta/` (lo usan asesoria y punto-venta)

- [ ] Moves + imports (grep: `ticket-service`, `resumen-compra`, `resumen-venta` — MUCHOS consumidores; ticket-service.spec.ts se actualiza junto)
- [ ] Gates completos
- [ ] `git add -A && git commit -m "refactor(): mover ticket-service a shared/ticket y resumenes a shared/ui (cross-feature)"`

---

### Task 9: `features/punto-venta/`

**Moves:**
- `src/app/pages/punto-venta/` → `src/app/features/punto-venta/pages/punto-venta/`
- `src/app/services/carrito-service.ts` + `.spec.ts` → `src/app/features/punto-venta/data/`

**SE QUEDAN por ahora** (decisión en 3c con la feature administración): `venta-service` (lo usan punto-venta y ventas-admin) y los modelos `venta-*` en `model/`.

**Rutas:** `punto-venta.routes.ts`; pages.routes delega `punto-venta` con loadChildren.

- [ ] Moves + rutas + imports
- [ ] Gates completos
- [ ] `git add -A && git commit -m "refactor(): migrar feature punto-venta a features/ con lazy loading"`

---

### Task 10: Eliminar `pages/ticket/` huérfano (HALLAZGO 3 — pedido del dueño)

`src/app/pages/ticket/ticket.ts` exporta un `TicketService` + `TicketVentaDatos` DUPLICADOS que nadie importa (el real vive ahora en `shared/ticket/`).

- [ ] Verificar orfandad: `grep -rn "pages/ticket\|from './ticket'\|from '../ticket'" src --include="*.ts" | grep -v "shared/ticket\|ticket-service\|ticket-contexto"` → CERO imports del archivo (si aparece alguno, DETENTE y repórtalo — no borrar)
- [ ] Verificar que ninguna ruta lo referencia: `grep -rn "ticket" src/app/pages/pages.routes.ts src/app/app.routes.ts`
- [ ] `git rm -r src/app/pages/ticket/`
- [ ] Gates completos (tsc app+spec, 403, build)
- [ ] `git add -A && git commit -m "chore(): eliminar pages/ticket huerfano (TicketService duplicado sin consumidores)"`

---

### Task 11: Verificación final de la oleada

- [ ] `npm run verificar` → 403 SUCCESS + build (habrá chunks lazy nuevos: inventario, corte-caja, asesorías, asistencia, punto-venta — esperado y deseable)
- [ ] Estructura: `features/{inventario,corte-caja,asesorias,asistencia,punto-venta}` cada una con pages/ y data/; `shared/{huella,ticket}` nuevos; `pages/` ya sin esas carpetas; `model/` solo con venta-*, membresia-patch, historial-data
- [ ] URLs INTACTAS: revisar pages.routes.ts — cada path pre-existente sigue igual (solo cambió el mecanismo de carga)
- [ ] Smoke test manual (usuario, contra producción con `npm run electron:prod` — el backend local sigue desincronizado): inventario abre, corte de caja abre, asesorías/entrenadores abren, asistencia + huella modal abre, punto de venta con carrito y cobro con resumen, ticket imprime/visualiza
- [ ] Reporte: desviaciones aplicadas (huella/ticket/resúmenes a shared), reclasificaciones (usuario-data, corte-caja-data), hallazgo 3 cerrado

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 3, alcance 3b):** features chicas ✓ (Tasks 3,4,5,7,9), lazy loading por feature ✓, URLs idénticas ✓, README de huella ✓ (Task 6, adelantado del spec), hallazgo 3 del dueño ✓ (Task 10), reclasificaciones por la regla 2+ features ✓ (Tasks 2,4). Quedan para 3c: socios, inscripciones, administración, cuenta (login/mi-perfil/home/menu-principal), venta-service/venta-models, docs/ARQUITECTURA.md.
- **Desviaciones:** 3 documentadas arriba con su justificación por grafo de imports; el usuario las verá en el reporte final de la oleada.
- **Placeholders:** rutas de ejemplo con código concreto; nombres de clases de componentes marcados VERIFICAR (el fuente gana); consumidores por grep.
