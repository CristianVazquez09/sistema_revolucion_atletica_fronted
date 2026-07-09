# Fase 2b — Tests de los servicios HTTP restantes: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cubrir con tests los ~20 servicios HTTP restantes (la Fase 2a ya cubrió Categoria, CheckIn parcial y Carrito), completando la red de seguridad de servicios antes de la reorganización de la Fase 3.

**Architecture:** Segunda oleada de la Fase 2 del spec `docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`. Cada spec copia los patrones fijados por los ejemplares de 2a: `src/app/services/categoria-service.spec.ts` (patrón GenericService/CRUD) y `src/app/services/check-in-service.spec.ts` (patrón de parámetros condicionales). Los "contratos" por servicio listados abajo vienen de un catálogo leído del código fuente el 2026-07-08 — **el archivo fuente SIEMPRE gana** sobre este plan si difieren.

**Tech Stack:** Angular 20, Karma + Jasmine, `HttpTestingController`. App en producción.

**Reglas transversales (idénticas a 2a más las lecciones aprendidas):**
- Código de producción INTOCABLE. Solo se crean archivos `*.spec.ts`.
- Tests documentan comportamiento AS-IS: si una aserción falla, se corrige la ASERCIÓN al valor real observado y se anota el hallazgo; nunca se toca el servicio.
- ANTES de escribir cada spec: leer COMPLETO el archivo del servicio. El contrato del plan es guía, el fuente es la verdad.
- Fixtures tipados completos (`const x: TipoData = {...}` con TODOS los campos requeridos del modelo — leer el modelo). PROHIBIDO `as unknown as`.
- Asertar SIEMPRE método/URL/params/body del request; el valor de respuesta se asevera UNA vez por spec (en el método de listado principal).
- `afterEach(() => httpMock.verify());` en todos los specs HTTP.
- Providers: `[provideHttpClient(), provideHttpClientTesting()]` (en ese orden).
- Jasmine clock: si un test necesita `install()`, va en `beforeEach`/`afterEach` de su propio `describe`, nunca inline en el `it`.
- No predecir totales de tests (en 2a los conteos del plan fallaron dos veces): reportar el total real tras cada task. Al inicio de 2b la suite tiene 65 tests.
- Commits: español, `test(): ...`, una línea, SIN trailer de coautoría. Nunca commitear `.claude/settings.local.json`.
- Comando: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -3` — debe terminar `SUCCESS` con 0 `FAILED`.

**Esqueleto estándar** (el mismo de los ejemplares; se repite aquí para lectura fuera de orden):

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { XxxService } from './xxx-service';
import { environment } from '../../environments/environment';

describe('XxxService', () => {
  const BASE = `${environment.HOST}/xxx`;
  let service: XxxService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(XxxService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // it(...) por método: verificar method/URL/params/body, flush mínimo
});
```

Para endpoints con query params usar `httpMock.expectOne(r => r.url === ...)` y asertar `req.request.params.get(...)`. Página vacía estándar para flush de paginados: `{ content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 }`.

---

### Task 1: Rama y línea base

- [ ] **Step 1:** `git checkout main && git checkout -b test/fase-2b-servicios-http`
- [ ] **Step 2:** `npm run test:ci 2>&1 | tail -3` → Expected: `Executed 65 of 65 SUCCESS`. Si no, DETENTE y repórtalo.

---

### Task 2: Servicios GenericService puros (Gimnasio, Rol, Asesoria)

**Files:**
- Create: `src/app/services/gimnasio-service.spec.ts`
- Create: `src/app/services/rol-service.spec.ts`
- Create: `src/app/services/asesoria-service.spec.ts`

Los tres extienden `GenericService` SIN métodos propios. Copiar el patrón completo de `categoria-service.spec.ts` (5 tests: buscarTodos GET base, buscarPorId GET base/{id}, guardar POST, actualizar PUT base/{id}, eliminar DELETE base/{id}), ajustando:

| Servicio | BASE | Modelo (leer para el fixture) |
|---|---|---|
| GimnasioService | `${environment.HOST}/gimnasios` | `GimnasioData` (`../model/gimnasio-data`) |
| RolService | `${environment.HOST}/roles` | `RolData` (`../model/rol-data`) |
| AsesoriaService | `${environment.HOST}/asesorias` | OJO: el catálogo dice que su genérico es `EntrenadorData` — leer la clase y usar el tipo real |

- [ ] **Step 1:** Leer los 3 servicios y sus modelos; construir fixtures tipados completos.
- [ ] **Step 2:** Escribir los 3 specs con el patrón del ejemplar.
- [ ] **Step 3:** `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -3` → SUCCESS, reportar total real.
- [ ] **Step 4:**

```bash
git add src/app/services/gimnasio-service.spec.ts src/app/services/rol-service.spec.ts src/app/services/asesoria-service.spec.ts
git commit -m "test(): cubrir servicios GenericService puros (gimnasio, rol, asesoria)"
```

---

### Task 3: Servicios de pocos métodos (Entrenador, Usuario, Historial, Inventario, Estadisticas)

**Files:**
- Create: `src/app/services/entrenador-service.spec.ts`
- Create: `src/app/services/usuario-service.spec.ts`
- Create: `src/app/services/historial-service.spec.ts`
- Create: `src/app/services/inventario-service.spec.ts`
- Create: `src/app/services/estadisticas-service.spec.ts`

Contratos (verificar contra fuente):

| Servicio | Métodos a testear |
|---|---|
| EntrenadorService (extiende Generic, `HOST/entrenadores`) | 5 heredados (patrón ejemplar) + `listarAsesoriasActivas(id)` GET `/entrenadores/{id}/asesorias-activas` |
| UsuarioService (extiende Generic, `HOST/usuarios`) | 5 heredados + `patchMiPerfil({nombre?,apellido?})` PATCH `/usuarios/mi-perfil` con body exacto |
| HistorialService (NO Generic, `HOST/historial`) | `consultar(pagina,tamanio)` GET con params page/size |
| InventarioService (NO Generic, `HOST/inventario`) | `turno({fecha,turno,gimnasioId?})` GET `/inventario/turno` — params fecha/turno siempre, gimnasioId solo si viene; `cerrar(payload)` POST `/inventario/cerrar` con body |
| EstadisticasService (NO Generic, base `HOST`) | `getDashboard(idGimnasio,desde,hasta)` GET `/estadisticas/dashboard` — desde/hasta siempre, idGimnasio condicional (verificar la condición exacta en el fuente: ¿null? ¿undefined? ¿0?) |

- [ ] **Step 1:** Leer los 5 servicios + modelos; anotar cualquier discrepancia con la tabla.
- [ ] **Step 2:** Escribir los 5 specs (heredados con patrón ejemplar; condicionales con patrón CheckIn: un test con el param presente y otro asertando `params.has(...) === false`).
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/entrenador-service.spec.ts src/app/services/usuario-service.spec.ts src/app/services/historial-service.spec.ts src/app/services/inventario-service.spec.ts src/app/services/estadisticas-service.spec.ts
git commit -m "test(): cubrir servicios entrenador, usuario, historial, inventario y estadisticas"
```

---

### Task 4: Login, Reportes y Menu

**Files:**
- Create: `src/app/services/login-service.spec.ts`
- Create: `src/app/services/reportes-service.spec.ts`
- Create: `src/app/services/menu-service.spec.ts`

Particularidades:
- **LoginService**: usa `environment.HOST_LOGIN` (http, SIN `/v1`), no HOST. `inicioSesion(nombreUsuario, contrasenia)` POST `${HOST_LOGIN}/inicio-sesion` body `{nombreUsuario, contrasenia}`. Asertar la URL con HOST_LOGIN — este test protege contra el error clásico de apuntar login al host equivocado.
- **ReportesService**: `listarGimnasios()` GET `${HOST}/gimnasios`; `descargarExcelMovimientos(idGimnasio,desde,hasta)` GET `${HOST}/reportes/movimientos/excel` con `responseType: 'blob'` — asertar `req.request.responseType === 'blob'` y params desde/hasta (+ idGimnasio condicional, verificar condición en fuente). Flush con `new Blob([])`.
- **MenuService**: extiende Generic (`HOST/menus`) → 5 heredados + `getMenusByUser(username)` POST `/menus/usuario` (verificar en el fuente CÓMO viaja el body: ¿string plano o objeto?). ADEMÁS tiene API de signals sin HTTP (`menuAbierto`, `toggleDrawer/abrirDrawer/cerrarDrawer`): 1-2 tests de estado (toggle alterna, cerrar pone false) sin httpMock — pueden ir en el mismo spec con un describe aparte.

- [ ] **Step 1:** Leer los 3 servicios; confirmar HOST_LOGIN, responseType blob y forma del body de menus.
- [ ] **Step 2:** Escribir los 3 specs.
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/login-service.spec.ts src/app/services/reportes-service.spec.ts src/app/services/menu-service.spec.ts
git commit -m "test(): cubrir login (HOST_LOGIN), reportes (blob) y menu (http + drawer)"
```

---

### Task 5: Producto y Paquete

**Files:**
- Create: `src/app/services/producto-service.spec.ts`
- Create: `src/app/services/paquete-service.spec.ts`

Contratos:
- **ProductoService** (extiende Generic, `HOST/productos`): 5 heredados + `buscarPorCategoria(idCategoria)` GET `/productos/buscar/{id}`; `buscarPorNombre(nombre)` GET `/productos/buscar/nombre/{nombre}` (¿encodeURIComponent? verificar); `registrarEntrada(id,{cantidad,nota?})` POST `/productos/{id}/stock/entrada`; `ajustarStock(id,{nuevoStock,nota?})` POST `/productos/{id}/stock/ajuste`. Asertar bodies exactos.
- **PaqueteService** (extiende Generic, `HOST/paquetes`): 5 heredados + `buscarPorNombre(nombre?,activo?)` GET `/paquetes/buscar` con AMBOS params condicionales (4 combinaciones → testear al menos: ninguno, ambos); `buscarPromocionesVigentes(id)` GET `/paquetes/{id}/promociones?vigentes=true`; `buscarPromociones(id,vigentes=false)` GET con `vigentes` según el arg.

- [ ] **Step 1:** Leer ambos servicios + modelos (ProductoData, PaqueteData) para fixtures.
- [ ] **Step 2:** Escribir los 2 specs.
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/producto-service.spec.ts src/app/services/paquete-service.spec.ts
git commit -m "test(): cubrir producto (stock) y paquete (busquedas y promociones)"
```

---

### Task 6: Promocion

**Files:**
- Create: `src/app/services/promocion-service.spec.ts`

**PromocionService** (extiende Generic, `HOST/promociones`; además usa `HOST` directo para rutas cruzadas de paquetes):
- 5 heredados (patrón ejemplar)
- `crear(payload)` POST base; `actualizarPromocion(id,payload)` PUT base/{id}
- `activar(id)` PATCH base/{id}/activar y `desactivar(id)` PATCH base/{id}/desactivar — verificar en fuente que el body es `null` y asertarlo
- **Rutas cruzadas** (la parte valiosa): `vincularPaquete(idPromocion, idPaquete)` PUT `${HOST}/paquetes/{idPaquete}/promociones/{idPromocion}` — OJO al ORDEN de los ids en la URL (invertido respecto a los args); `desvincularPaquete(idPromocion, idPaquete)` DELETE misma URL. Un test que fije ese orden previene un bug clásico de refactor.
- `listar()` — verificar en fuente si delega en buscarTodos (si sí, un test de que pega a GET base basta)

- [ ] **Step 1:** Leer el servicio; confirmar orden de ids y bodies null.
- [ ] **Step 2:** Escribir el spec.
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/promocion-service.spec.ts
git commit -m "test(): cubrir promocion (activar/desactivar y vinculo cruzado con paquetes)"
```

---

### Task 7: Socio (incluye huella)

**Files:**
- Create: `src/app/services/socio-service.spec.ts`

**SocioService** (extiende Generic, `HOST/socios`):
- 5 heredados
- `buscarSocios(pagina,tamanio,tipoPaquete?,activo?)` GET `/socios/buscar` — page/size siempre; tipoPaquete y activo condicionales (verificar condición exacta: el catálogo sugiere que `activo` va con `if (activo != null)` o similar — el fuente decide; probar presente y ausente)
- `buscarSociosPorNombre(nombre,pagina,tamanio,activo?,tipoPaquete?,soloVigentes?)` GET `/socios/buscar` con nombre + condicionales
- `obtenerAsesoriasDeSocio(id,pagina,tamanio)` GET `/socios/{id}/asesorias`
- **Huella** (la parte crítica del negocio): `buscarPorHuella(huellaDigital)` POST `/socios/buscar-por-huella`; `registrarHuella(id,base64)` POST `/socios/{id}/huella`; `actualizarHuella(id,base64)` PUT `/socios/{id}/huella`. El servicio tiene un privado `limpiarBase64` que quita el prefijo DataURL — testearlo VÍA los públicos: llamar `buscarPorHuella('data:image/png;base64,AAAA')` y asertar que el body lleva `'AAAA'` limpio (verificar el comportamiento exacto en el fuente primero).

- [ ] **Step 1:** Leer servicio + SocioData (fixture completo: el modelo tiene varios requeridos — género con unión literal, etc.).
- [ ] **Step 2:** Escribir el spec (huella incluida vía métodos públicos).
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/socio-service.spec.ts
git commit -m "test(): cubrir socio (busquedas, asesorias y huella con limpieza base64)"
```

---

### Task 8: Membresia

**Files:**
- Create: `src/app/services/membresia-service.spec.ts`

**MembresiaService** (extiende Generic, `HOST/membresias`) — el servicio paginado más rico; los detalles de offset son ORO para el refactor de Fase 5:
- 5 heredados
- `buscarMembresiasPorSocio(idSocio,pagina,tamanio)` GET `/membresias/buscar/socio/{id}` con page/size
- `buscarMembresiasVigentesPorSocio(idSocio)` GET `/membresias/por-socio/{id}/vigentes`
- `listar({page?,size?,sort?})` GET base — ATENCIÓN: el catálogo indica que resta 1 a page (`page-1`), defaults size=10 y sort=`fechaInicio,desc`. Verificar en fuente y asertar los TRES comportamientos: llamada sin args manda page=?(el default real), size=10, sort=fechaInicio,desc; llamada con page=3 manda page=2.
- `patch(id,body)` PATCH base/{id} con `MembresiaPatchRequest` (fixture: `{acciones:[{op:'CAMBIAR_DESCUENTO',nuevoDescuento:50}]}`)
- `buscarPorFolio(folio)` GET `/membresias/folio/{folio}`
- `buscarPorNombreSocio(q,{page?,size?,sort?})` GET `/membresias/buscar/socio-nombre` con q
- `listarPorRango(desde,hasta,{...})` GET `/membresias/rango` — desde/hasta siempre, sort condicional
- `reinscripcionAnticipada(payload)` POST `/membresias/reinscripcion/anticipada`
- `guardarBatch(membresias[])` POST `/membresias/batch` body `{membresias}`
- `reinscripcionAnticipadaBatch(membresias[])` POST `/membresias/batch/reinscripcion/anticipada` body `{membresias}`

- [ ] **Step 1:** Leer servicio completo + MembresiaData/MembresiaPatch; anotar defaults y offsets reales.
- [ ] **Step 2:** Escribir el spec (el test de `listar` con page-1 es el más importante del task).
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/membresia-service.spec.ts
git commit -m "test(): cubrir membresia (paginacion con offset, patch, folio, rango y batch)"
```

---

### Task 9: Venta y CorteCaja

**Files:**
- Create: `src/app/services/venta-service.spec.ts`
- Create: `src/app/services/corte-caja-service.spec.ts`

Particularidades (los dos comportamientos más raros de la capa de servicios — verificar con cuidado en fuente):
- **VentaService** (extiende Generic, `HOST/ventas`): `crearVenta(payload)` POST base — el catálogo dice que DESENVUELVE la respuesta: si el backend devuelve un array, entrega `[0]`. Asertar: flush `[ventaMock]` → el subscriber recibe `ventaMock` (no el array). Verificar también qué pasa si devuelve objeto plano (leer el fuente; si maneja ambos, testear ambos). Además: `listar({page?,size?,sort?})` GET base con page-1; `patch(id,body)` PATCH base/{id}; `buscarPorFolio(folio)` GET `/ventas/folio/{folio}`; `listarPorRango({desde,hasta,...})` GET `/ventas/rango`.
- **CorteCajaService** (extiende Generic, `HOST/cortes`): `abrir(req)` POST `/cortes/abrir`; `cerrar(id,req)` POST `/cortes/{id}/cerrar`; `consultar(id)` GET `/cortes/{id}`; **`consultarAbierto()` GET `/cortes/abierto` — el catálogo dice que usa observe response y convierte 404 en `of(null)`**: dos tests, uno flusheando 200 con corte (subscriber recibe el corte) y otro con `req.flush('', {status: 404, statusText: 'Not Found'})` (subscriber recibe `null`, SIN error). `previsualizar(id,hasta?)` GET `/cortes/{id}/preview` con hasta condicional; `previsualizarAbierto(hasta?)`; `registrarSalida(id,req)` POST `/cortes/{id}/salidas`; `listarSalidas(id)` GET; `desgloseActual()` GET `/cortes/actual/desglose`; `listar({estado?,page?,size?,sort?})` GET base con page-1 y estado condicional; `desglose(id)` GET `/cortes/{id}/desglose`.

- [ ] **Step 1:** Leer ambos servicios completos; confirmar el unwrap de crearVenta y el manejo 404 de consultarAbierto.
- [ ] **Step 2:** Escribir los 2 specs.
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/venta-service.spec.ts src/app/services/corte-caja-service.spec.ts
git commit -m "test(): cubrir venta (unwrap de crearVenta) y corte-caja (404 como null, salidas y desglose)"
```

---

### Task 10: Notificacion (signals + timers) y completar CheckIn

**Files:**
- Create: `src/app/services/notificacion-service.spec.ts`
- Modify: `src/app/services/check-in-service.spec.ts` (agregar 2 tests)

- **NotificacionService** (sin HTTP): signal `notificaciones` + `abrir/exito/error/info/aviso/cerrar/limpiar` y auto-cierre con `setTimeout`. Leer el fuente para: forma del objeto notificación, duración default, si `cerrar(id)` filtra por id. Tests con `jasmine.clock()` (en beforeEach/afterEach del describe): (1) `exito('msg')` agrega una notificación al signal; (2) `cerrar(id)` la quita; (3) avanzar el reloj `jasmine.clock().tick(duraciónDefault + 1)` y asertar que se auto-cerró; (4) `limpiar()` vacía todo.
- **CheckInService** — completar los 2 métodos que 2a dejó fuera (hallazgo del review): `listarHistorialRango(pagina,tamanio,desde,hasta,idSocio?)` GET `/asistencias/rango` — desde/hasta siempre, idSocio condicional; `buscarPorNombreSocio(pagina,tamanio,nombre)` GET `/asistencias/buscar` con nombre. Agregar los 2 `it(` al spec existente respetando su estilo.

- [ ] **Step 1:** Leer notificacion-service.ts completo (duración default exacta) y los 2 métodos de check-in.
- [ ] **Step 2:** Escribir spec nuevo + 2 tests agregados.
- [ ] **Step 3:** Correr tests → SUCCESS, reportar total.
- [ ] **Step 4:**

```bash
git add src/app/services/notificacion-service.spec.ts src/app/services/check-in-service.spec.ts
git commit -m "test(): cubrir notificacion (auto-cierre con reloj) y completar check-in (rango y nombre)"
```

---

### Task 11: Verificación final de la oleada

- [ ] **Step 1:** `npm run verificar` → TODOS los tests SUCCESS + build con las 2 warnings de presupuesto conocidas.
- [ ] **Step 2:** `git log --oneline main..HEAD && git diff main --stat | tail -3` → ~9 commits, SOLO archivos `.spec.ts` nuevos (+2 tests en check-in-service.spec.ts).
- [ ] **Step 3:** Reporte final: total de tests de la suite, tiempo de ejecución, lista completa de hallazgos AS-IS/discrepancias contra este plan encontradas en el camino (especialmente: condiciones exactas de params condicionales, el unwrap de crearVenta, el 404→null de corte, y cualquier endpoint que difiera del catálogo).

**Cobertura al cierre de 2b:** los 26 servicios de `src/app/services/` quedan cubiertos EXCEPTO: `generic-service.ts` (cubierto indirectamente por todos los extenders), `ticket-service.ts` (va en 2c), `fingerprint.service.ts` (eliminado en Fase 1) y `layout-ui.service.ts` (trivial, 3 métodos de un signal — si sobra tiempo en Task 10, agregar un mini-spec de 2 tests; opcional, no bloquea).

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 2, alcance 2b):** los ~20 servicios HTTP restantes ✓ (Tasks 2-10), completar CheckIn ✓ (Task 10, cierra el hallazgo del review de 2a), NotificacionService ✓. Quedan para 2c: reducers/selectors NgRx, helpers puros de ticket-service, preferencias-usuario. layout-ui declarado opcional explícitamente.
- **Placeholders:** los contratos por servicio son concretos (verbo, URL, params, body, comportamientos especiales); el código completo del patrón vive en los 2 ejemplares ya mergeados a main + el esqueleto de este plan. La instrucción sistemática "leer el fuente primero, el fuente gana" es la salvaguarda AS-IS del plan, no un hueco.
- **Consistencia:** nombres de servicios/métodos tomados del catálogo leído del fuente en esta sesión (2026-07-08); rutas de archivos verificadas contra `src/app/services/`.
