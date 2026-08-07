# Arquitectura — Revolución Atlética Frontend

Este documento es el mapa vivo de `src/app/` tras la Fase 3 de la reorganización (spec:
[`docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`](superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md)).
La estructura real difiere ligeramente del diseño original: durante la migración se
descubrió que varios servicios y componentes eran consumidos por 3+ features (o por
componentes ya compartidos), así que se aplicó con más consistencia la regla "2+ =
compartido" que el propio spec ya establecía para los modelos.

## Estructura de carpetas

```
src/app/
├─ core/                       # Infraestructura global, se carga una vez
│  ├─ auth/                    # login-service, guards (admin, gerente, operacion), auth.interceptor
│  ├─ tenant/                  # tenant-context-service, tenant.interceptor
│  ├─ http/                    # server-errors.interceptor, getHttpErrorMessage, http-error.tokens, generic-service
│  └─ layout/                  # layout-ui-service, menu-service, notificacion-service (+ notificacion-host)
│
├─ shared/
│  ├─ data/                    # Servicios de negocio transversales — ver regla abajo
│  │                           # (gimnasio-service, membresia-service)
│  ├─ models/                  # Tipos usados por 2+ features (SocioData, PaqueteData,
│  │                           # UsuarioData, CorteCajaData, PagedResponse, HistorialData…)
│  ├─ ui/                      # Componentes compartidos: ra-gimnasio-filter, resumen-compra, resumen-venta
│  ├─ util/                    # fechas-precios, preferencias-usuario, tiempo-plan-label, enums
│  ├─ ticket/                  # ticket-service — 10+ páginas de 6+ features lo consumen
│  └─ huella/                  # Integración DigitalPersona — ver huella/README.md
│
└─ features/
   ├─ socios/                  # pages/socio (+ socio-informacion, socio-modal, socio-info-asesoria)
   │                           # data/socio-service
   │
   ├─ inscripciones/           # pages/{inscripcion,reinscripcion,agregar-membresia}
   │                           # data/historial-service, models/historial-data
   │                           # inscripcion/state/ y reinscripcion/state/ (NgRx — sale en Fase 5)
   │
   ├─ administracion/          # pages/administracion (shell admin/gerencia + corte-caja-admin,
   │                           # estadisticas, membresia, promociones, reportes, usuarios-admin,
   │                           # ventas-admin) + pages/{producto,categoria,paquete} (catálogo)
   │                           # data/{categoria,estadisticas,producto,promocion,reportes,
   │                           # rol,usuario,venta,paquete}-service
   │                           # models/venta-data, venta-create, venta-patch, detalle-venta-data
   │
   ├─ cuenta/                  # pages/{login,menu-principal,mi-perfil,home}
   │                           # menu-principal es el shell de /pages/*
   │
   ├─ asesorias/                # asesoria, asesoria-nutricional, entrenador (Fase 3b)
   ├─ asistencia/                # asistencia, historial de asistencia, check-in-service (Fase 3b)
   ├─ corte-caja/                # corte-caja + modal (Fase 3b)
   ├─ inventario/                # inventario diario (Fase 3b)
   └─ punto-venta/               # punto-venta + carrito-service (Fase 3b)
```

Cada feature sigue el mismo patrón interno:

```
features/<feature>/
├─ pages/<página>/       # componente(s) standalone, con sus modales/sub-vistas anidados
├─ data/<servicio>.ts    # servicios HTTP propios de la feature
└─ models/<modelo>.ts    # tipos que SOLO esa feature consume
```

No todas las features tienen los tres subdirectorios — `cuenta`, por ejemplo, no tiene
`data/` propio porque reutiliza servicios de `core/layout` y consume `usuario-service`
(administracion) y `corte-caja-service` (corte-caja) directamente.

## Regla de "compartido"

**Modelos → `shared/models/`** si 2+ features importan el tipo (regla original del spec,
sin cambios).

**Servicios de negocio → `shared/data/`** si se cumple **cualquiera** de:
- **(a)** Lo consume un componente que ya vive en `shared/ui`. Regla dura: `shared/`
  nunca debe depender de una `feature/`, así que si un componente compartido necesita el
  servicio, el servicio también es compartido (caso: `ra-gimnasio-filter` inyecta
  `GimnasioService` directamente).
- **(b)** Lo consumen 3 o más de las 4 features "grandes" (socios, inscripciones,
  administracion, cuenta) — o el equivalente en cualquier combinación de features.

Con exactamente **2** consumidores, el servicio se queda en la feature dueña del recurso
(quien tiene el CRUD primario) y la otra feature cruza con un import directo hacia
`features/<dueña>/data/...`. Ejemplos de este patrón, ya en el código:
- `menu-principal.ts` (cuenta) importa `CorteCajaService` (corte-caja) — comentario en el
  sitio explica el cruce.
- `inscripciones` importa `socio-service` (socios), `paquete-service` (administracion).
- `mi-perfil.ts` (cuenta) importa `usuario-service` (administracion).
- `punto-venta` (Fase 3b) importa `venta-service`, `categoria-service`, `producto-service`
  (administracion).

Estos cruces **no son deuda técnica** — son dependencias de dominio normales (ej.
inscribir a alguien requiere leer el catálogo de paquetes que administra Administración).
Solo se documentan con un comentario cuando el cruce no es obvio a simple vista.

## Convenciones de nombrado

(Resumen — la referencia completa está en el spec original, sección "Convenciones de
nombrado".)

- **Idioma:** español para el dominio; inglés solo para términos del framework
  (`ngOnInit`, `trackBy`).
- **Servicios:** `nombre-service.ts`.
- **Modelos**, un sufijo por propósito:
  - `XxxData` — respuesta del backend (`SocioData`, `VentaData`)
  - `XxxCreate` — payload para crear
  - `XxxPatch` — payload de actualización parcial
  - `XxxFiltro` — parámetros de búsqueda/filtrado
- **Atributos:** camelCase sin abreviaturas; sin `any`; uniones literales/enums para
  valores cerrados; cero comentarios-changelog (`// ✅ NUEVO`, `// 👈...`) — eso lo cuenta
  git, no el código.
- **Funciones:**
  - `verboObjeto()` — acciones (`cargarSocios()`)
  - `onEvento()` — handlers de template (`onBuscarChange()`)
  - `esX()` / `tieneX()` / `puedeX()` — predicados booleanos
  - `aXxx()` / `xxxDesdeYyy()` — transformaciones
  - Booleanos con prefijo: `estaCargando`, `hayError`, `mostrarModal`.
- **Componentes UI compartidos** (Fase 4, pendiente): prefijo `ra-`.
- **Rutas:** cada feature expone sus páginas vía `loadComponent`/`loadChildren` — no hay
  imports eager de componentes de página en `pages.routes.ts` ni `app.routes.ts`.

## Huella digital (DigitalPersona)

Ver [`shared/huella/README.md`](../src/app/shared/huella/README.md) — documenta la
cadena completa: `websdk.js` (script global) → shim `WebSdk` → `@digitalpersona/devices`
(parchado) → `huella-reader-singleton` → `huella-modal`.

## Estado NgRx (transitorio)

`features/inscripciones/pages/inscripcion/state/` y
`features/inscripciones/pages/reinscripcion/state/` siguen usando NgRx (reducers +
selectors). Es la única parte de la app en ese patrón — el resto usa servicios +
signals. La Fase 5 los reemplaza por un store de signals; los tests actuales de los
reducers/selectors (`*-state.spec.ts`) son la base de esos tests futuros.

## Fuera de alcance de la Fase 3

- **Componentes gigantes** (`inscripcion.ts`, `reinscripcion.ts`,
  `reinscripcion-adelantada.ts`, `ticket-service.ts`) y la **salida de NgRx** →
  Fase 5.
- **Sistema de diseño** (componentes `ra-*`, orden de clases Tailwind) → Fase 4.

## Hallazgos abiertos (no resueltos en Fase 3, requieren decisión del usuario)

- `Administracion` (shell de `/admin` y `/gerencia`) referencia un tile de menú
  `gimnasios` (`data.allowed` lo incluye) sin ruta `admin/gimnasios` correspondiente —
  enlace roto o feature sin terminar.
- `provideHttpClient()` aparece llamado dos veces en `app.config.ts` (hallazgo de Fase 3a,
  aún sin resolver).
