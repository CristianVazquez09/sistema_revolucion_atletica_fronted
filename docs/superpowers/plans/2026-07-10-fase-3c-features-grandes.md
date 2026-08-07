# Fase 3c — Migración de features grandes (cierre de Fase 3): Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar todo lo que queda en `pages/`, `services/` y `model/` a `features/{socios,inscripciones,administracion,cuenta}`, crear `shared/data/` para los 2 servicios genuinamente transversales, eliminar una ruta muerta, y cerrar la Fase 3 con `docs/ARQUITECTURA.md`.

**Architecture:** Tercera y última oleada de la Fase 3 del spec. 3a dejó `core/` y `shared/`; 3b movió las features chicas. 3c mueve el resto: `socios`, `inscripciones`, `administracion` (la más grande: incluye producto, categoría y paquete como catálogo admin) y `cuenta` (login, menú principal, mi-perfil, home). Mismo patrón de siempre: `features/<f>/pages/`, `features/<f>/data/` (servicios), `features/<f>/models/` (tipos propios de la feature).

**Tech Stack:** Angular 20 standalone, git mv, gates: tsc (app+spec) + 403 tests + build por task.

**Reglas transversales (las de 3a/3b):**
- Solo `git mv` + imports + rutas. Único cambio de lógica permitido: convertir entradas de ruta de eager a `loadComponent`/`loadChildren` (mismo path, mismo orden, guards intactos).
- Specs viajan con su fuente. Gates completos antes de cada commit.
- ⚠️ **Commits: una sola línea, `refactor(): ...` (o `chore():` para limpieza), SIN trailer de coautoría.** Después de cada commit correr `git log -1 --format=%B` y verificar; si aparece un trailer, `git commit --amend` para quitarlo (en 3b un implementador lo agregó una vez — no debe repetirse).
- Nunca commitear `.claude/settings.local.json`.
- Descubrimiento de consumidores SIEMPRE por grep; las listas de este plan salen del catálogo del 2026-07-10 y pueden quedar cortas.
- Verificar co-ubicación de `templateUrl`/`styleUrl` al mover componentes con `.html`/`.css` (lección de la Task 6 de 3b).

**REGLA NUEVA de esta oleada — umbral para `shared/data/` (nueva carpeta, servicios de negocio transversales):**
Un servicio pasa a `shared/data/` si **(a)** lo consume un componente que YA vive en `shared/` (regla dura — ej. `ra-gimnasio-filter` inyecta `GimnasioService` directamente, así que `GimnasioService` DEBE ser shared o `shared/ui` quedaría dependiendo de una feature), **o (b)** lo consumen 3 o más de las 4 features de esta oleada. Si lo consumen exactamente 2, se queda en la feature dueña del recurso (quien tiene el CRUD primario) y la otra feature cruza con import documentado — mismo patrón ya usado con `corte-caja-service` ← `menu-principal` en 3b. Los modelos siguen la regla de 3a sin cambios (2+ features → `shared/models/`).

**Mapa de propiedad de servicios/modelos restantes (aplicando la regla):**

| Servicio | Consumidores (features) | Destino |
|---|---|---|
| `gimnasio-service` | socios, inscripciones, administracion + `shared/ui/ra-gimnasio-filter` | **shared/data/** (regla a) |
| `membresia-service` | socios, inscripciones, administracion (3) | **shared/data/** (regla b) |
| `paquete-service` | inscripciones, administracion (2) | administracion (dueño del CRUD de catálogo) |
| `socio-service` | socios, inscripciones (2) | socios (dueño del recurso) |
| `usuario-service` | administracion, cuenta (2) | administracion (dueño del CRUD de usuarios) |
| `venta-service` + `venta-*` | administracion, punto-venta (ya migrada, 2) | administracion |
| `historial-service` | inscripciones, asistencia (ya migrada, 2) | inscripciones |
| `categoria-service`, `estadisticas-service`, `producto-service`, `promocion-service`, `reportes-service`, `rol-service` | solo administracion | administracion |
| `membresia-patch.ts` (modelo) | va con membresia-service | **shared/models/** |
| `historial-data.ts` (modelo) | inscripciones + asistencia (ya migrada) | **shared/models/** (2 features) |
| `venta-data/venta-create/venta-patch/detalle-venta-data` | administracion (+ punto-venta cross) | features/administracion/models/ |

`paquete-data.ts` y `socio-data.ts` ya están en `shared/models/` desde 3a (nada que mover ahí).

**HALLAZGOS para decisión del usuario (NO se tocan en este plan, se reportan en Task 11):**
1. `pages.routes.ts` tiene una ruta `{ path: 'membresia', redirectTo: 'membresia', pathMatch: 'full' }` que se redirige a sí misma — muerta, provablemente inerte. Este plan SÍ la elimina (Task 9) porque es zero-behavior y análoga al hallazgo 3 de 3b, pero se avisa por si el usuario prefiere revisarla antes.
2. La plantilla de `Administracion` referencia un tile de menú `gimnasios` (`ruta:['gimnasios']`) que **no tiene ruta correspondiente** en `pages.routes.ts` — enlace roto o feature sin terminar. NO se toca; se reporta como hallazgo para que el usuario decida.

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b refactor/fase-3c-features-grandes`
- [ ] `npm run test:ci 2>&1 | tail -3` → `403 SUCCESS`. Si no, DETENTE.

---

### Task 2: `shared/data/` — gimnasio-service y membresia-service

**Moves:**
- `src/app/services/gimnasio-service.ts` + `.spec.ts` → `src/app/shared/data/`
- `src/app/services/membresia-service.ts` + `.spec.ts` → `src/app/shared/data/`
- `src/app/model/membresia-patch.ts` → `src/app/shared/models/`

**Consumidores a actualizar (grep amplio — la lista es orientativa, el grep manda):**
- `gimnasio-service`: `pages/categoria`, `pages/administracion/promociones`, `pages/administracion/usuarios-admin/usuarios-admin-modal`, `pages/agregar-membresia`, `pages/inscripcion`, `pages/inscripcion/reinscripcion-adelantada`, `pages/paquete/paquete-modal`, `pages/producto/producto-modal`, `pages/reinscripcion`, `pages/socio/socio-modal`, `shared/ui/ra-gimnasio-filter`
- `membresia-service`: `pages/administracion/membresia`, `pages/administracion/membresia/membresia-modal`, `pages/agregar-membresia`, `pages/inscripcion`, `pages/inscripcion/reinscripcion-adelantada`, `pages/reinscripcion`, `pages/socio/socio-informacion`
- `membresia-patch`: `pages/administracion/membresia/membresia-modal`, `services/membresia-service.spec.ts` (ahora `shared/data/membresia-service.spec.ts`)

**Gates:** tsc app / tsc spec / test:ci 403 / build.

**Commit:**
```bash
git add -A
git commit -m "refactor(): crear shared/data con gimnasio-service y membresia-service (uso transversal)"
```
Verificar sin trailer.

---

### Task 3: `features/socios/`

**Moves:**
- `src/app/services/socio-service.ts` + `.spec.ts` → `src/app/features/socios/data/`
- `src/app/pages/socio/` completo (socio.ts, `socio-informacion/`, `socio-modal/`, `socio-info-asesoria/`) → `src/app/features/socios/pages/socio/`

**Rutas en `pages.routes.ts`:** convertir en el sitio (mismo path/posición, sin guard) a `loadComponent`:
- `socio` → `Socio`
- `socio/:idSocio/historial` → `SocioInformacion`
- `socio/:idSocio/asesorias` → `SocioInfoAsesoria`

**Consumidores cross-feature de socio-service (quedan como import cruzado documentado, NO se mueven):** `pages/agregar-membresia`, `pages/inscripcion/reinscripcion-adelantada`, `pages/reinscripcion` — actualizar sus imports a `../../features/socios/data/socio-service` (recalcular profundidad real).

**Gates:** tsc app / tsc spec / test:ci 403 / build (nuevos chunks lazy).

**Commit:**
```bash
git add -A
git commit -m "refactor(): migrar feature socios a features/ con lazy loading"
```
Verificar sin trailer.

---

### Task 4: `features/inscripciones/`

**Moves:**
- `src/app/services/historial-service.ts` + `.spec.ts` → `src/app/features/inscripciones/data/`
- `src/app/model/historial-data.ts` → `src/app/shared/models/` (2 features: inscripciones + asistencia ya migrada)
- `src/app/pages/inscripcion/` completo (inscripcion.ts, `historial/`, `reinscripcion-adelantada/`, `state/`) → `src/app/features/inscripciones/pages/inscripcion/`
- `src/app/pages/reinscripcion/` completo (reinscripcion.ts, `state/`) → `src/app/features/inscripciones/pages/reinscripcion/`
- `src/app/pages/agregar-membresia/` → `src/app/features/inscripciones/pages/agregar-membresia/`

**Consumidor cruzado de `historial-data.ts` a actualizar (feature YA migrada en 3b, se toca solo el import):** `src/app/features/asistencia/data/check-in-service.ts`, `src/app/features/asistencia/pages/asistencia-historial/asistencia-historial.ts` → apuntar a `../../../shared/models/historial-data` (recalcular).

**Rutas en `pages.routes.ts`:** convertir en el sitio a `loadComponent`:
- `inscripcion` → `Inscripcion`
- `reinscripcion-adelantada` → `ReinscripcionAdelantada`
- `historial` → `Historial`
- `agregar-membresia` → `AgregarMembresia`
- `reinscripcion/:id` → `Reinscripcion`

**Gates:** tsc app / tsc spec / test:ci 403 / build.

**Commit:**
```bash
git add -A
git commit -m "refactor(): migrar feature inscripciones (inscripcion, reinscripcion, agregar-membresia) a features/"
```
Verificar sin trailer.

---

### Task 5: `features/administracion/` — parte A (servicios, modelos, páginas)

**Moves de servicios** (`src/app/services/*` → `src/app/features/administracion/data/`, con specs):
`categoria-service`, `estadisticas-service`, `producto-service`, `promocion-service`, `reportes-service`, `rol-service`, `usuario-service`, `venta-service`, `paquete-service`

**Moves de modelos** (`src/app/model/*` → `src/app/features/administracion/models/`):
`venta-data.ts`, `venta-create.ts`, `venta-patch.ts`, `detalle-venta-data.ts`

**Moves de páginas** (`src/app/pages/*` → `src/app/features/administracion/pages/`):
- `administracion/` completo (incluye el shell `administracion.ts`/`.html` + subcarpetas `corte-caja-admin/`, `estadisticas/`, `membresia/`, `promociones/`, `reportes/`, `usuarios-admin/`, `ventas-admin/`) → `features/administracion/pages/administracion/`
- `producto/` (+ `producto-modal/`, `stock-modal/`) → `features/administracion/pages/producto/`
- `categoria/` → `features/administracion/pages/categoria/`
- `paquete/` (+ `paquete-modal/`) → `features/administracion/pages/paquete/`

**Consumidores cruzados a actualizar (grep amplio — NO mover estos archivos, solo su import):**
- `venta-service`/`venta-create`: `src/app/features/punto-venta/pages/punto-venta/punto-venta.ts` (ya migrada en 3b)
- `usuario-service`: `src/app/pages/mi-perfil/mi-perfil.ts` (se mueve completo en Task 7 — aquí solo se actualiza el import; el archivo se recolocará después)
- `paquete-service`: `src/app/features/inscripciones/pages/inscripcion/*`, `reinscripcion/*`, `agregar-membresia/*` (ya movidos en Task 4 — actualizar sus imports)

**NO se toca en este task:** las rutas de `pages.routes.ts` (van en la Task 6, por separado dado el volumen).

**Gates:** tsc app / tsc spec / test:ci 403 / build.

**Commit:**
```bash
git add -A
git commit -m "refactor(): migrar servicios, modelos y paginas de administracion (incl. producto, categoria, paquete) a features/"
```
Verificar sin trailer.

---

### Task 6: `features/administracion/` — parte B (rutas)

Convertir en `pages.routes.ts`, en el sitio, TODAS estas entradas a `loadComponent`/`loadChildren` según corresponda, preservando path/posición/guards EXACTOS (leer el archivo completo antes de tocar nada):

- `paquete` → `Paquete`
- `productos` → `Producto` (**preservar** `canMatch: [operacionGuard]`)
- `categoria` → `Categoria`
- `membresia` (recepción, `data:{scope:'recepcion'}`) → `Membresia`
- `ventas` (recepción, `data:{scope:'recepcion'}`) → `VentasAdmin`
- `admin` (shell, **preservar** `canMatch:[adminGuard]`) → `Administracion`, con sus children: `admin/membresias`, `admin/corte-caja`, `admin/ventas`, `admin/usuarios`, `admin/estadisticas`, `admin/reportes`, `admin/promociones` (cada uno a su componente correspondiente ya movido; `admin/asesorias-nutricionales` YA es lazy y ya apunta a `features/asesorias` — no tocar)
- `gerencia` (shell, **preservar** `canMatch:[gerenteGuard]`) → mismo `Administracion`, con children: `gerencia/membresias`, `gerencia/corte-caja`, `gerencia/ventas`, `gerencia/promociones`

Verificar nombres reales de clases exportadas en cada componente movido antes de escribir los `import()`.

**Gates:** tsc app / tsc spec / test:ci 403 / build (build mostrará ~9 nuevos chunks lazy).

**Commit:**
```bash
git add -A
git commit -m "refactor(): convertir rutas de administracion a lazy loading (admin, gerencia y catalogo)"
```
Verificar sin trailer.

---

### Task 7: `features/cuenta/`

**Moves:**
- `src/app/login/login.ts` (+ `.html`/`.css` si existen; carpeta RAÍZ, fuera de `pages/`) → `src/app/features/cuenta/pages/login/`
- `src/app/pages/menu-principal/` → `src/app/features/cuenta/pages/menu-principal/`
- `src/app/pages/mi-perfil/` → `src/app/features/cuenta/pages/mi-perfil/` (su import de `usuario-service` ya se actualizó en Task 5 hacia `features/administracion/data/usuario-service` — aquí solo recalcular profundidad tras el move)
- `src/app/pages/home/` → `src/app/features/cuenta/pages/home/`

**Actualizar el comentario TODO de menu-principal.ts** (dejado en 3b): reemplazar

```typescript
// TODO(Fase 3c): edge cross-feature temporal; menu-principal migra a features/cuenta
```

por

```typescript
// Cross-feature: cuenta muestra el estado del corte de caja abierto (dato de features/corte-caja)
```

(el import de `CorteCajaService` se queda — es un cruce normal y permanente, no deuda técnica).

**Rutas:**
- `src/app/app.routes.ts` (raíz): `{ path: 'login', component: Login }` → `loadComponent`; `{ path: 'pages', component: MenuPrincipal, loadChildren: ... }` → `component` pasa a `loadComponent` también (mismo `loadChildren` ya presente, solo se agrega lazy al shell).
- `src/app/pages/pages.routes.ts`: la entrada `''` (home, ya lazy con `loadComponent: './home/home'`) y `mi-perfil` (ya lazy con `'./mi-perfil/mi-perfil'`) — actualizar SOLO la ruta del import a `../features/cuenta/pages/home/home` y `../features/cuenta/pages/mi-perfil/mi-perfil` respectivamente (ya eran lazy, no hay conversión que hacer, solo reapuntar el path).

**Gates:** tsc app / tsc spec / test:ci 403 / build.

**Commit:**
```bash
git add -A
git commit -m "refactor(): migrar feature cuenta (login, menu-principal, mi-perfil, home) a features/"
```
Verificar sin trailer.

---

### Task 8: Verificar que `pages/`, `services/`, `model/` quedaron vacíos de código de features

- [ ] `ls src/app/pages/` → debe quedar SOLO `pages.routes.ts` (ningún subfolder de página). Si sobra algo, es una feature que este plan no catalogó — DETENTE y repórtalo, no lo borres ni lo muevas sin decisión.
- [ ] `ls src/app/services/` → debe estar VACÍO o no existir.
- [ ] `ls src/app/model/` → debe estar VACÍO o no existir.
- [ ] Si `services/` o `model/` quedaron vacíos, `git rm -r` (si git los trackeaba) o simplemente confirmar que no quedan en disco.
- [ ] Gates completos.
- [ ] Si hubo cambios: `git add -A && git commit -m "chore(): limpiar carpetas services y model vacias tras migracion completa"` (verificar sin trailer). Si no hubo cambios, saltar el commit.

---

### Task 9: Eliminar ruta muerta `membresia` (auto-redirect)

En `pages.routes.ts` existe `{ path: 'membresia', redirectTo: 'membresia', pathMatch: 'full' }` — se redirige a sí misma, provablemente inerte (Angular nunca completaría esa navegación en un ciclo útil).

- [ ] Releer el archivo completo, confirmar que la entrada real y funcional `membresia` (`data:{scope:'recepcion'}` → `Membresia`) sigue existiendo aparte y no se ve afectada.
- [ ] Eliminar SOLO la entrada de auto-redirect.
- [ ] Gates completos (tsc app/spec, 403, build).
- [ ] `git add -A && git commit -m "chore(): eliminar ruta membresia con auto-redirect muerto"` — verificar sin trailer.

---

### Task 10: `docs/ARQUITECTURA.md` (cierre de la Fase 3)

Crear `docs/ARQUITECTURA.md` con:

```markdown
# Arquitectura — Revolución Atlética Frontend

## Estructura de carpetas

src/app/
├─ core/                  # auth, tenant, http, layout — infraestructura global
├─ shared/
│  ├─ data/               # servicios de negocio transversales (3+ features, o
│  │                       # consumidos desde shared/ui): gimnasio-service, membresia-service
│  ├─ models/              # tipos usados por 2+ features
│  ├─ ui/                  # componentes compartidos (ra-gimnasio-filter, resumen-compra, resumen-venta)
│  ├─ util/                # utilidades y enums puros
│  ├─ ticket/               # ticket-service (11+ consumidores cross-feature)
│  └─ huella/                # integración DigitalPersona — ver huella/README.md
└─ features/
   ├─ socios/
   ├─ inscripciones/       # incluye estado NgRx (inscripcion/state, reinscripcion/state)
   ├─ administracion/       # incluye catálogo: producto, categoria, paquete
   ├─ cuenta/                # login, menu-principal (shell), mi-perfil, home
   ├─ asesorias/ · asistencia/ · corte-caja/ · inventario/ · punto-venta/  (Fase 3b)

Cada feature: pages/<página>/, data/<servicios>, models/<tipos propios> (si aplica).

## Convenciones de nombrado

[Copiar aquí el resumen de la sección 1b del spec original:
docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md
— sufijos de modelo (XxxData/XxxCreate/XxxPatch/XxxFiltro), patrones de
funciones (verboObjeto, onEvento, esX/tieneX, aXxx), idioma español.]

## Regla de "compartido"

Un modelo va a shared/models/ si lo importan 2+ features.
Un servicio va a shared/data/ si lo consume un componente de shared/, o si
lo consumen 3+ features. Con exactamente 2 consumidores, el servicio se
queda en la feature dueña del recurso y la otra cruza con import directo
(documentado con un comentario cuando el cruce no es obvio).

## Huella digital

Ver shared/huella/README.md — cadena completa DigitalPersona.

## Fuera de alcance de la Fase 3

Componentes gigantes (inscripcion.ts, reinscripcion.ts, ticket-service.ts) y
la salida de NgRx quedan para la Fase 5. El sistema de diseño (componentes ra-*)
es la Fase 4.
```

- [ ] Escribir el archivo con el contenido de arriba, completando el bloque de convenciones leyendo `docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`.
- [ ] `git add docs/ARQUITECTURA.md && git commit -m "docs(): agregar ARQUITECTURA.md - mapa de features y convenciones (cierre Fase 3)"` — verificar sin trailer.

---

### Task 11: Verificación final, smoke test y hallazgos

- [ ] `npm run verificar` → 403 SUCCESS + build (las 2 warnings de presupuesto conocidas; ahora deberían verse MÁS chunks lazy nuevos, no menos)
- [ ] Confirmar estructura: `features/{socios,inscripciones,administracion,cuenta}` cada una con `pages/`; `shared/data/` nuevo con 2 servicios; `pages/`, `services/`, `model/` vacíos o inexistentes
- [ ] URLs intactas: releer `pages.routes.ts` y `app.routes.ts` completos, confirmar que cada `path:` pre-existente sigue igual
- [ ] Smoke test manual del usuario (Electron, `npm run electron:prod` contra producción — sincronizar backend local sigue pendiente del usuario): login, menú principal (rol admin y no-admin), socios (alta, historial, asesorías), inscripción y reinscripción completas, agregar membresía, administración (las 7 subsecciones: corte-caja-admin, estadísticas, membresía, promociones, reportes, usuarios, ventas), catálogo (producto, categoría, paquete), mi perfil, home
- [ ] Reportar al usuario: (1) el hallazgo de la ruta `gimnasios` sin componente (tile de menú roto — NO se tocó), (2) confirmación de que la Fase 3 completa del spec queda CERRADA (3a core/shared + 3b features chicas + 3c features grandes + docs/ARQUITECTURA.md)

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 3, cierre completo):** las 4 features restantes ✓ (Tasks 2-7), `shared/data/` como extensión razonada de la regla de 3a/3b ✓, `docs/ARQUITECTURA.md` ✓ (Task 10, mandato explícito del spec para el cierre de Fase 3), limpieza de carpetas obsoletas ✓ (Task 8), hallazgo de ruta muerta resuelto ✓ (Task 9, análogo al hallazgo 3 de 3b), hallazgo de `gimnasios` reportado sin tocar ✓ (Task 11).
- **Placeholders:** el mapa de propiedad de servicios está resuelto con criterio explícito (no "decidir después"); las rutas de ejemplo tienen paths reales tomados del catálogo; "VERIFICAR nombres de clase" es la salvaguarda AS-IS estándar de este plan, no un hueco.
- **Consistencia:** Task 5 mueve archivos de administracion pero NO sus rutas (Task 6 aparte) — deliberado por volumen; Task 7 depende de que Task 5 ya haya tocado el import de usuario-service en mi-perfil.ts antes de moverlo — orden de tareas verificado correcto.
- **Fuera de alcance, documentado:** componentes gigantes y salida de NgRx → Fase 5; sistema de diseño `ra-*` → Fase 4.
