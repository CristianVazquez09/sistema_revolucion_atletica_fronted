# Spec: Reorganización de arquitectura, sistema de diseño y limpieza

**Fecha:** 2026-07-07
**Estado:** Aprobado por Cristian (diseño validado por secciones en sesión de brainstorming)

## Contexto

App de gestión de gimnasio "Revolución Atlética": Angular 20 (standalone) + Tailwind 4 + Electron + NgRx (parcial). **En producción activa**, por lo que todo el trabajo es incremental, sin cambios de comportamiento, y cada fase termina con la app funcionando y publicable.

Problemas actuales:

- Componentes gigantes: `inscripcion.ts` (1,962 líneas), `reinscripcion.ts` (1,523), `ticket-service.ts` (1,433), `reinscripcion-adelantada.ts` (1,379). Los tres flujos de inscripción duplican lógica entre sí.
- Estructura por capas con inconsistencias: 26 servicios planos en `services/`, `core/` con solo 2 archivos, `shared/` casi vacío, carpeta muerta `pages/administration/`, naming mixto (`fingerprint.service.ts` vs `socio-service.ts`).
- NgRx instalado pero usado solo en 2 features; el resto usa servicios + signals (26 archivos ya usan signals).
- Sin sistema de diseño: clases Tailwind repetidas en cada template (la unificación de tablas "estilo membresías" se hizo copiando clases a mano).
- Solo 1 archivo de test en todo el proyecto (`app.spec.ts`).
- Código muerto: dependencias sin uso, shims duplicados de WebSdk, config de Vite que Angular no lee.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Prioridad | 1) Componentes gigantes, 2) Sistema de diseño, 3) Arquitectura, 4) Limpieza |
| Riesgo | Producción activa → incremental, sin cambios de comportamiento |
| Estado | Quitar NgRx, estandarizar en servicios + signals |
| Sistema de diseño | Componentes Angular compartidos (`shared/ui`, prefijo `ra-`) |
| Estructura | Por features (`core/`, `shared/`, `features/`) |
| Verificación | Cobertura amplia de tests ANTES de mover código |
| Secuencia | Fases horizontales (un solo tipo de cambio por fase) |

## Estructura objetivo

```
src/app/
├─ core/                      # Global, se carga una vez
│  ├─ auth/                   # login-service, guards (admin, gerente, operacion), auth.interceptor
│  ├─ tenant/                 # tenant-context-service, tenant.interceptor
│  ├─ http/                   # server-errors.interceptor, getHttpErrorMessage, http-error.tokens, generic-service
│  └─ layout/                 # layout-ui-service, menu-service, notificacion-service
├─ shared/
│  ├─ ui/                     # ra-tabla, ra-modal, ra-boton, ra-input, ra-select, ra-badge, ra-dropdown, ra-paginador, ra-buscador
│  ├─ models/                 # paged-response y tipos usados por 2+ features (GimnasioData, UsuarioData…)
│  └─ util/                   # fechas-precios, preferencias-usuario, enums, pipes
└─ features/
   ├─ socios/                 # socio + modales + socio-service + models
   ├─ inscripciones/          # inscripcion, reinscripcion, reinscripcion-adelantada, agregar-membresia + data/ compartida
   ├─ asistencia/             # asistencia, check-in-service, huella/ (modal + singleton + README)
   ├─ punto-venta/            # punto-venta, carrito, resumen-venta/compra, ticket
   ├─ inventario/             # producto, categoria, inventario, stock
   ├─ asesorias/              # asesoria, asesoria-nutricional, entrenador
   ├─ corte-caja/             # corte-caja + modales
   ├─ administracion/         # membresia, paquete, promociones, usuarios-admin, ventas-admin, estadisticas, reportes, corte-caja-admin
   └─ cuenta/                 # login, mi-perfil, home, menu-principal
```

Regla para `shared/models/`: si 2+ features importan un modelo, es shared; si no, vive en `features/x/models/`.

## Convenciones de nombrado

### Archivos

- Servicios: `nombre-service.ts` (patrón mayoritario actual; se renombran `fingerprint.service.ts` → eliminado por muerto, `layout-ui.service.ts` → `layout-ui-service.ts`).
- Componentes UI compartidos: prefijo `ra-`.
- Cada feature expone rutas con lazy loading (`loadChildren`/`loadComponent`).

### Idioma

Español para el dominio; inglés solo para términos del framework (`ngOnInit`, `trackBy`). Se corrigen híbridos (`mapFiltroEstadoToBoolean` → `filtroEstadoComoBoolean`).

### Modelos — un sufijo por propósito

| Sufijo | Uso | Ejemplo |
|---|---|---|
| `XxxData` | Respuesta del backend | `SocioData`, `VentaData` |
| `XxxCreate` | Payload para crear | `VentaCreate` |
| `XxxPatch` | Payload de actualización parcial | `MembresiaPatch` |
| `XxxFiltro` | Parámetros de búsqueda/filtrado | `SocioFiltro` |

Atributos:

- camelCase, sin abreviaturas (`fechaNacimiento`, no `fechaNac`).
- Sin `any`; uniones literales o enums para valores cerrados.
- Alias `type FechaIso = string;` para fechas ISO (sustituye comentarios repetidos).
- `?` solo cuando el backend realmente puede omitir el campo.
- Cero comentarios-changelog (`// ✅ NUEVO`, `// 👈 reemplaza…`); eso lo cuenta git.

### Funciones

| Patrón | Uso | Ejemplo |
|---|---|---|
| `verboObjeto()` | Acciones | `cargarSocios()`, `calcularPrecioFinal()` |
| `onEvento()` | Handlers de template | `onBuscarChange()`, `onGuardar()` |
| `esX()` / `tieneX()` / `puedeX()` | Predicados booleanos | `tieneRol()`, `esMembresiaVigente()` |
| `aXxx()` / `xxxDesdeYyy()` | Transformaciones | `rolesDesdeToken()` |

- Funciones públicas no obvias llevan JSDoc de 1–2 líneas (qué hace y qué devuelve).
- Una función = una responsabilidad; si necesita "y" para describirse, se parte.
- Booleanos con prefijo: `estaCargando`, `hayError`, `mostrarModal`.

## Fases

Nota sobre el orden: aunque la prioridad del usuario pone los componentes gigantes primero, las fases se ordenan por dependencia técnica — no se puede partir un gigante con seguridad sin tests (Fase 2), ni conviene partirlo antes de que exista su destino (`features/`, Fase 3) y los componentes UI que usará (Fase 4).

### Fase 1 — Limpieza de código muerto

Dependencias sin uso (imports verificados en la exploración; re-verificar antes de borrar):

- `chart.js`, `html2canvas`, `jspdf`: no se importan en ningún archivo → fuera.
- `heroicons`: los SVG están pegados en templates, el paquete no se importa → fuera.

Archivos y configuración:

- `src/app/pages/administration/` (carpeta vacía) → borrar.
- `src/app/app.css` (0 líneas) → borrar junto con su referencia.
- `tailwind.config.ts`: Tailwind 4 usa config CSS-first en `src/styles.css` (`@theme`); nadie referencia el `.ts` (no hay `@config`). Consolidar los tokens de marca que solo existen en el `.ts` dentro de `@theme` y borrar el archivo.
- Barrido de imports sin uso y código comentado en `src/app`.

Zona Electron/huella:

- `electron/main.js` y `electron/preload.js`: **en uso** (impresión de tickets + auto-updater + puente IPC). No se tocan.
- `src/app/services/fingerprint.service.ts`: **muerto** (nadie importa `FingerprintService`; el lector real es `huella-reader-singleton.ts` + `huella-modal.ts`) → borrar.
- `vite.config.ts`: **muerto** (Angular CLI con `@angular/build` no lo lee; su alias apunta a `src/websdk.ts`, que no existe) → borrar.
- `src/shims/websdk.ts`: shim duplicado, mapeado solo en `tsconfig.app.json` paths → verificar con build y borrar junto con la entrada de tsconfig.
- **Se quedan**: `src/shims/WebSdk/` (paquete falso vía `"WebSdk": "file:src/shims/WebSdk"`, resuelve el `require('WebSdk')` de `@digitalpersona/devices`), `src/assets/websdk/websdk.js` (SDK real, script global en angular.json), `patches/@digitalpersona+devices+0.2.6.patch` + `patch-package`.

Verificación: cada eliminación se prueba con `npm run build:web` + arranque en Electron antes de commitear, una por una.

### Fase 2 — Red de seguridad de tests

Cobertura amplia enfocada en comportamiento (sobrevive al refactor), con Karma + Jasmine ya configurados:

1. Utilidades puras (`fechas-precios`, `tiempo-plan-label`, `ticket-contexto`): cálculos de dinero y vigencias.
2. Los 26 servicios con `HttpTestingController`: URL, parámetros, mapeo de respuesta.
3. Lógica de los flujos gigantes (totales de inscripción, carrito, corte de caja, generación de ticket): documentan el comportamiento actual antes de partirlos.
4. Reducers/selectors de NgRx: tests ligeros que luego se portan al store con signals.

Meta: `ng test` verde y estable antes de mover un solo archivo.

### Fase 3 — Migración a `features/`

- Solo mover/renombrar, cero cambios de lógica. Una feature por PR/commit.
- Orden: primero chicas y aisladas (inventario, asesorías, corte-caja), al final las grandes (inscripciones, administración).
- Cada paso: mover archivos, renombrar a convención, actualizar imports, rutas con lazy loading.
- Verificación por paso: `ng test` verde + `npm run build:web` + arranque manual del módulo movido.

### Fase 4 — Sistema de diseño `shared/ui`

| Componente | Reemplaza |
|---|---|
| `ra-tabla` | Las ~20 tablas unificadas (header, filas, estado vacío, acciones vía slots) |
| `ra-paginador` | Controles de paginación repetidos (recibe `PagedResponse`) |
| `ra-modal` | Cascarón de los ~15 modales (backdrop, panel, header, cierre) |
| `ra-dropdown` | Patrón "position fixed anti-clipping" ya resuelto |
| `ra-boton` | `.btn-primary-red` y variantes (primario, secundario, peligro, fantasma) |
| `ra-input` / `ra-select` | `.input`, `.select-wrap` (con label, error, requerido) |
| `ra-badge` | Pills de estado, variantes por color semántico |
| `ra-buscador` | Input de búsqueda con debounce y normalización |

- Tokens: colores de marca solo en `@theme` de `styles.css` con nombres semánticos (`--color-primario`, `--color-peligro`).
- Orden de clases Tailwind: instalar Prettier + `prettier-plugin-tailwindcss`; aplicar a todo el repo en un commit propio.
- Adopción página por página (un commit por página); las clases `@apply` de `styles.css` se eliminan al quedar sin usos.

### Fase 5 — Partir gigantes y salida de NgRx

Flujos de inscripción — lógica común a `features/inscripciones/data/`:

- `calculo-membresia-service`: precios, descuentos, vigencias (lógica pura, la más testeada).
- `inscripcion-store`: estado del flujo con signals (reemplaza reducers/selectors de NgRx; se portan sus tests).
- Sub-componentes de UI: selector de paquete, resumen de pago, captura de datos.
- Cada página queda como orquestador delgado. **Meta: ningún componente >400 líneas.**

`ticket-service.ts` se parte en: generación de HTML por tipo de ticket como funciones puras + servicio delgado de impresión que habla con Electron.

Al terminar: eliminar `@ngrx/store`, `@ngrx/effects`, `@ngrx/store-devtools` del package.json.

## Mejoras adicionales incluidas

1. Lazy loading real por feature (echarts solo carga en estadísticas).
2. `ChangeDetectionStrategy.OnPush` en componentes migrados a signals.
3. `docs/ARQUITECTURA.md`: mapa de features, convenciones de nombrado, y mapa de la cadena de huella (websdk.js global → shim → @digitalpersona → singleton → modal). Además, `README.md` corto en `features/asistencia/huella/`.
4. Script `npm run verificar`: build + tests en un comando, para antes de cada release.

## Fuera de alcance

- Migrar de Karma a otro test runner.
- Cambiar el patrón de auto-update de Electron.
- Rediseños visuales nuevos (solo se consolida el estilo existente).
- Features nuevas de negocio.

## Criterios de éxito

- Cada fase termina con `ng test` verde, `npm run build:web` exitoso y la app verificada manualmente en Electron.
- Ningún componente >400 líneas al final de la Fase 5.
- Un solo patrón de estado (signals), un solo patrón de naming, estilos definidos una sola vez.
- Se puede publicar un release al final de cada fase.
