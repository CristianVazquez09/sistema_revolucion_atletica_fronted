# Fase 3a — Migración de cimientos a `core/` y `shared/`: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la estructura `core/` (auth, tenant, http, layout) y `shared/` (ui, models, util) del spec moviendo los cimientos transversales — SOLO movimientos y renombres, cero cambios de lógica, protegido por los 403 tests.

**Architecture:** Primera de tres oleadas de la Fase 3 del spec `docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`. 3a = cimientos (esto). 3b = features chicas (inventario, asesorías, corte-caja, asistencia, punto-venta...). 3c = features grandes (socios, inscripciones, administración, cuenta) + `docs/ARQUITECTURA.md`. Las páginas siguen en `pages/` hasta 3b/3c; los servicios de negocio siguen en `services/` hasta que su feature exista.

**Tech Stack:** Angular 20 standalone. Todos los moves con `git mv` (preserva historia). Suite de 403 tests + build como verificación por task.

**Reglas transversales:**
- CERO cambios de lógica. Solo `git mv`, renombres de archivo y actualización de imports/rutas de import. Ni una línea de comportamiento.
- Los specs (`*.spec.ts`) viajan JUNTO a su fuente en el mismo `git mv`.
- Tras cada task: `npm run test:ci` (403 SUCCESS) + `npm run build:web` (2 warnings de presupuesto conocidas) ANTES de commitear.
- Para encontrar TODOS los consumidores de un archivo movido (imports relativos Y absolutos `src/app/...`): `grep -rn "nombre-del-archivo-sin-extension" src --include="*.ts"` y actualizar cada uno. OJO: 24 archivos usan imports absolutos `src/app/...` — también se actualizan cuando el destino cambia.
- Convención de nombres: servicios `nombre-service.ts` (se renombran `layout-ui.service.ts` → `layout-ui-service.ts` y `tenant-context.service.ts` → `tenant-context-service.ts`); interceptores conservan su patrón `*.interceptor.ts`; guards conservan su nombre.
- Commits: español, `refactor(): ...`, una línea, SIN trailer. Nunca `.claude/settings.local.json`.
- **HALLAZGOS QUE NO SE TOCAN** (documentados por la exploración, se reportan al final, NO son parte de esta fase): (1) `app.config.ts` llama `provideHttpClient` DOS veces (líneas ~39-40) — posible bug de wiring de interceptores, decisión del dueño; (2) ruta `membresia` en pages.routes.ts que se redirige a sí misma; (3) `pages/ticket/ticket.ts` exporta un `TicketService` duplicado que nadie importa (candidato a borrar en 3c); (4) `model/detalle-venta-data.ts` reportado como huérfano — VERIFICAR (venta-data.ts podría importarlo) antes de creer el reporte.

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b refactor/fase-3a-core-shared`
- [ ] `npm run test:ci 2>&1 | tail -3` → `403 SUCCESS`. Si no, DETENTE.

---

### Task 2: `core/auth/` — guards, interceptor de auth y login-service

**Moves (git mv):**
- `src/app/guards/admin-guards.ts` → `src/app/core/auth/admin-guards.ts`
- `src/app/guards/gerente-guards.ts` → `src/app/core/auth/gerente-guards.ts`
- `src/app/guards/operacion-guards.ts` → `src/app/core/auth/operacion-guards.ts`
- `src/app/interceptor/auth.interceptor.ts` → `src/app/core/auth/auth.interceptor.ts`
- `src/app/services/login-service.ts` → `src/app/core/auth/login-service.ts`
- `src/app/services/login-service.spec.ts` → `src/app/core/auth/login-service.spec.ts`

**Consumidores a actualizar (verificar con grep, esta lista viene de la exploración):**
- `src/app/pages/pages.routes.ts` — imports de `adminGuard`, `gerenteGuard`, `operacionGuard` (`../guards/...` → `../core/auth/...`; ojo: pages.routes está en `pages/`, la ruta relativa correcta es `../core/auth/admin-guards`)
- `src/app/app.config.ts` — import de `authInterceptor`
- `src/app/login/login.ts` — import de `LoginService`
- Los propios archivos movidos: sus imports relativos a `environment`, `model/`, etc. cambian de profundidad (`../../environments/...` sigue igual solo si la profundidad se mantiene — `core/auth/` tiene la MISMA profundidad que `guards/`, así que la mayoría no cambia; el que sí: `login-service.ts` venía de `services/` con la misma profundidad, verificar cada import del archivo)
- `login-service.spec.ts` — su import de `environment` (`../../environments/` sigue válido) y de `./login-service` (igual)

**Steps:**
- [ ] `git mv` de los 6 archivos (crear carpeta con el primer mv)
- [ ] `grep -rn "guards/\|auth.interceptor\|login-service" src --include="*.ts" | grep -v "core/auth"` → actualizar cada import hallado
- [ ] `npx tsc -p tsconfig.app.json --noEmit` → limpio; luego `npm run test:ci` → 403 SUCCESS; `npm run build:web` → OK
- [ ] Commit: `git add -A && git commit -m "refactor(): mover guards, auth interceptor y login-service a core/auth"`
- [ ] Borrar la carpeta `src/app/guards/` si quedó vacía (git mv ya la vació; confirmar con ls)

---

### Task 3: `core/tenant/` — interceptor y servicio de tenant (con rename)

**Moves:**
- `src/app/core/tenant.interceptor.ts` → `src/app/core/tenant/tenant.interceptor.ts`
- `src/app/core/tenant-context.service.ts` → `src/app/core/tenant/tenant-context-service.ts` (MOVE + RENAME a la convención)

**Consumidores (9, la mayoría con import ABSOLUTO `src/app/core/tenant-context.service` que cambia a `src/app/core/tenant/tenant-context-service`):**
- `src/app/app.config.ts` (TenantInterceptor)
- `src/app/shared/ra-app-zoom/ra-gimnasio-filter/ra-gimnasio-filter.ts`
- `src/app/pages/socio/socio.ts`, `pages/producto/producto.ts`, `pages/corte-caja/corte-caja.ts`
- `src/app/pages/administracion/corte-caja-admin/corte-caja-admin.ts`, `administracion/ventas-admin/ventas-admin.ts`, `administracion/membresia/membresia.ts`
- El propio `tenant.interceptor.ts` (importa el servicio) y los imports internos del servicio (usa absoluto `src/environments/environment` — sobrevive)

**Steps:**
- [ ] `git mv` ambos (el rename del servicio en el mismo mv)
- [ ] `grep -rn "tenant-context\|tenant.interceptor" src --include="*.ts"` → actualizar TODOS (la clase `TenantContextService` NO cambia de nombre, solo el archivo)
- [ ] tsc + test:ci (403) + build → OK
- [ ] Commit: `git add -A && git commit -m "refactor(): mover tenant interceptor y context service a core/tenant con rename a convencion"`

---

### Task 4: `core/http/` — errores de servidor y generic-service

**Moves:**
- `src/app/interceptor/server-errors.interceptor.ts` → `src/app/core/http/server-errors.interceptor.ts`
- `src/app/interceptor/getHttpErrorMessage.ts` → `src/app/core/http/getHttpErrorMessage.ts`
- `src/app/interceptor/http-error.tokens.ts` → `src/app/core/http/http-error.tokens.ts`
- `src/app/services/generic-service.ts` → `src/app/core/http/generic-service.ts`

**Consumidores:**
- `src/app/app.config.ts` (ServerErrorsInterceptor)
- `grep -rn "http-error.tokens\|getHttpErrorMessage" src` — consumidores del token `NO_GLOBAL_ERROR_TOAST` (hay páginas/servicios que lo usan para suprimir toasts — encontrarlos TODOS)
- **14 servicios** extienden GenericService con `from './generic-service'` → cambia a `from '../core/http/generic-service'`: categoria, entrenador, gimnasio, corte-caja, promocion, asesoria, rol, producto, paquete, membresia, menu, socio, usuario, venta (verificar lista con grep)
- `server-errors.interceptor.ts` importa `NotificacionService` desde `../services/notificacion-service` → nueva profundidad `../../services/notificacion-service`

**Steps:**
- [ ] `git mv` de los 4
- [ ] `grep -rn "generic-service\|server-errors\|http-error.tokens\|getHttpErrorMessage" src --include="*.ts" | grep -v "core/http"` → actualizar todos
- [ ] tsc + test:ci (403) + build → OK. Borrar `src/app/interceptor/` si quedó vacía.
- [ ] Commit: `git add -A && git commit -m "refactor(): mover interceptor de errores, tokens http y generic-service a core/http"`

---

### Task 5: `core/layout/` — servicios de layout y el host de notificaciones

**Moves:**
- `src/app/services/layout-ui.service.ts` → `src/app/core/layout/layout-ui-service.ts` (RENAME a convención)
- `src/app/services/layout-ui.service.spec.ts` → `src/app/core/layout/layout-ui-service.spec.ts` (actualizar su import `./layout-ui.service` → `./layout-ui-service`)
- `src/app/services/menu-service.ts` + `menu-service.spec.ts` → `src/app/core/layout/`
- `src/app/services/notificacion-service.ts` + `notificacion-service.spec.ts` → `src/app/core/layout/`
- `src/app/pages/notificacion-host/` (carpeta completa) → `src/app/core/layout/notificacion-host/` (es parte del shell: solo lo monta `app.ts`, no es una página)

**Consumidores:**
- `src/app/app.ts` (NotificacionHost import)
- `grep -rn "layout-ui\|menu-service\|notificacion-service\|notificacion-host" src --include="*.ts" | grep -v "core/layout"` — menu-principal usa menu-service y layout-ui; MUCHAS páginas usan notificacion-service; server-errors.interceptor (ya en core/http) usa notificacion-service → su import cambia a `../layout/notificacion-service`
- La clase `LayoutService` NO cambia de nombre (solo el archivo)

**Steps:**
- [ ] `git mv` de todo
- [ ] Grep + actualizar todos los imports
- [ ] tsc + test:ci (403) + build → OK
- [ ] Commit: `git add -A && git commit -m "refactor(): mover servicios de layout y notificacion-host a core/layout"`

---

### Task 6: `shared/util/` — utilidades y enums

**Moves (carpeta completa con specs):**
- `src/app/util/fechas-precios.ts` + `.spec.ts` → `src/app/shared/util/`
- `src/app/util/tiempo-plan-label.ts` + `.spec.ts` → `src/app/shared/util/`
- `src/app/util/ticket-contexto.ts` + `.spec.ts` → `src/app/shared/util/`
- `src/app/util/preferencias-usuario.ts` + `.spec.ts` → `src/app/shared/util/`
- `src/app/util/enums/` (carpeta) → `src/app/shared/util/enums/`

**Consumidores:** `grep -rn "util/fechas-precios\|util/tiempo-plan-label\|util/ticket-contexto\|util/preferencias-usuario\|util/enums" src --include="*.ts"` — hay MUCHOS (páginas, servicios, states de NgRx, specs). Los imports internos de los movidos también cambian de profundidad (p.ej. ticket-contexto importa `../services/ticket-service` → `../../services/ticket-service`; fechas-precios importa `./enums/tiempo-plan` → igual).

**Steps:**
- [ ] `git mv` de todo (incluida la carpeta enums)
- [ ] Grep + actualizar (usar reemplazo sistemático: `app/util/` → `app/shared/util/` en absolutos; recalcular relativos por archivo)
- [ ] tsc + test:ci (403) + build → OK. Borrar `src/app/util/` vacía.
- [ ] Commit: `git add -A && git commit -m "refactor(): mover utilidades y enums a shared/util"`

---

### Task 7: `shared/models/` — modelos compartidos (2+ features)

**Moves — SOLO los 12 compartidos** (clasificación por matriz de imports de la exploración 2026-07-09):
- `socio-data.ts`, `membresia-data.ts`, `paquete-data.ts`, `gimnasio-data.ts`, `paged-response.ts`, `entrenador-data.ts`, `asesoria-contrato-data.ts`, `promocion-data.ts`, `producto-data.ts`, `categoria-data.ts`, `menu-data.ts`, `rol-data.ts` — todos de `src/app/model/` → `src/app/shared/models/`

**SE QUEDAN en `src/app/model/`** (feature-owned; migran con su feature en 3b/3c): `usuario-data.ts`, `membresia-patch.ts`, `venta-data.ts`, `venta-create.ts`, `venta-patch.ts`, `corte-caja-data.ts`, `historial-data.ts`, `asistencia-historial-data.ts`, `inventario-diario-data.ts`, `asesoria-nutricional-data.ts`, `asesoria-data.ts`, `detalle-venta-data.ts`.

OJO: `membresia-data.ts` importa `PagoData`... verificar sus imports internos entre modelos (varios modelos se importan entre sí: venta-data importa de membresia-data y detalle-venta-data; membresia-patch importa PagoData de membresia-data). Al mover los 12, los que se quedan en `model/` y los importaban ajustan a `../shared/models/...` y viceversa.

**Consumidores:** decenas — `grep -rn "model/socio-data\|model/membresia-data\|model/paquete-data\|model/gimnasio-data\|model/paged-response\|model/entrenador-data\|model/asesoria-contrato\|model/promocion-data\|model/producto-data\|model/categoria-data\|model/menu-data\|model/rol-data" src --include="*.ts"`. Estrategia: reemplazo sistemático por archivo movido, recalculando profundidad relativa; los absolutos `src/app/model/X` → `src/app/shared/models/X`.

**Steps:**
- [ ] Verificar la clasificación con grep ANTES de mover (si algún "feature-owned" resulta importado por 2+ features, muévelo también y repórtalo)
- [ ] `git mv` de los 12 (+ ajustar imports internos entre modelos)
- [ ] Grep + actualizar todos los consumidores
- [ ] tsc + test:ci (403) + build → OK
- [ ] Commit: `git add -A && git commit -m "refactor(): mover los 12 modelos compartidos a shared/models"`

---

### Task 8: `shared/ui/` — ra-gimnasio-filter

**Moves:**
- `src/app/shared/ra-app-zoom/ra-gimnasio-filter/ra-gimnasio-filter.ts` → `src/app/shared/ui/ra-gimnasio-filter/ra-gimnasio-filter.ts`
- Borrar la carpeta `src/app/shared/ra-app-zoom/` que queda vacía

**Consumidores (imports ABSOLUTOS en 5+ páginas):** `grep -rn "ra-gimnasio-filter" src --include="*.ts"` → corte-caja-admin, membresia, ventas-admin, corte-caja, producto (+ los que aparezcan). El componente además importa TenantContextService/GimnasioService/GimnasioData con rutas que ya cambiaron en Tasks 3/7 (se habrán actualizado entonces; verificar).

**Steps:**
- [ ] `git mv` + borrar carpeta vacía
- [ ] Grep + actualizar consumidores
- [ ] tsc + test:ci (403) + build → OK
- [ ] Commit: `git add -A && git commit -m "refactor(): mover ra-gimnasio-filter a shared/ui"`

---

### Task 9: Verificación final de la oleada

- [ ] `npm run verificar` → 403 SUCCESS + build con las 2 warnings conocidas
- [ ] Estructura resultante esperada: `core/{auth,tenant,http,layout}`, `shared/{ui,models,util}`; carpetas `guards/`, `interceptor/`, `util/` eliminadas; `services/` solo con servicios de negocio; `model/` solo con modelos feature-owned
- [ ] `git log --oneline main..HEAD` → ~7 commits, `git diff main --stat` → SOLO renames/moves + líneas de import (cero lógica); verificar con `git diff main --find-renames --stat | grep -v "=>" | head` que los no-renombrados solo cambian imports
- [ ] Smoke test manual en Electron (usuario): login → socios → punto de venta → huella modal → estadísticas → notificaciones aparecen al guardar algo
- [ ] Reporte de hallazgos NO tocados: provideHttpClient duplicado, ruta membresia auto-redirect, pages/ticket/ticket.ts huérfano, estado real de detalle-venta-data.ts

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 3, alcance 3a):** core/auth ✓, core/tenant ✓, core/http ✓, core/layout ✓ (Tasks 2-5), shared/util ✓ (6), shared/models con regla "2+ features" ✓ (7), shared/ui ✓ (8). Los renombres a convención (`layout-ui-service`, `tenant-context-service`) ✓. Lazy loading por feature NO va en 3a (va con las features en 3b/3c). notificacion-host reubicado a core/layout con justificación (solo lo monta el shell).
- **Placeholders:** las listas de consumidores vienen de la exploración con archivos exactos; los greps por task son la salvaguarda contra listas desactualizadas.
- **Riesgo controlado:** cada task termina compilando con 403 tests verdes; los moves con git mv preservan historia; los hallazgos de wiring quedan explícitamente FUERA de alcance.
