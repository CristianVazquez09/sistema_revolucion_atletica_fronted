# Fase 2c — Tests de estado NgRx, helpers de ticket y preferencias: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la Fase 2 del spec: tests de los reducers/selectors NgRx (inscripción/reinscripción), de la lógica pura de `ticket-service` (dinero, normalización, HTML de tickets) y de `preferencias-usuario` + `layout-ui-service`.

**Architecture:** Tercera y última oleada de la Fase 2 del spec `docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`. Los tests de NgRx documentan el comportamiento que la Fase 5 portará a signals (los tests de reducers se convertirán en los tests del store). Los helpers de ticket-service son PRIVADOS: se testean por bracket-access (`service['money'](...)`) — aceptable porque la Fase 5 los extraerá a funciones exportadas y ESTOS tests serán su red de seguridad. Catálogo verificado contra fuente el 2026-07-09; **el fuente gana**.

**Tech Stack:** Angular 20, Karma + Jasmine, NgRx 20 (reducers puros + selectors vía `.projector()`). App en producción.

**Reglas transversales (heredadas de 2a/2b):**
- Código de producción INTOCABLE; solo archivos `*.spec.ts` nuevos.
- AS-IS: aserciones se ajustan al comportamiento real; hallazgos se documentan con comentario, no se "arreglan". Las asimetrías inscripción/reinscripción son deliberadas del negocio (reinscripción no cobra inscripción) — documentar, no unificar.
- Jasmine clock solo en beforeEach/afterEach de su describe.
- Fixtures tipados completos; sin `as unknown as`; el ÚNICO cast permitido es el bracket-access a privados de ticket-service (documentado con un comentario al inicio del describe).
- Commits: español, `test(): ...`, una línea, SIN trailer de coautoría. Nunca `.claude/settings.local.json`.
- No predecir totales; reportar el total real (baseline: 238).
- Locale: los helpers de fecha usan Intl es-MX y la máquina es UTC-6; pasar fechas explícitas y asertar el formato observado.

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b test/fase-2c-ngrx-ticket`
- [ ] `npm run test:ci 2>&1 | tail -3` → `238 SUCCESS`. Si no, DETENTE.

---

### Task 2: Estado NgRx de inscripción

**Files:**
- Test (create): `src/app/pages/inscripcion/state/inscripcion-state.spec.ts`

Leer primero los 4 archivos de `src/app/pages/inscripcion/state/`. Contratos:

**Reducer** (probar despachando acciones reales contra estados literales propios — NO depender del initialState para los sets):
- `setListaPaquetes({paquetes})` reemplaza la lista; `setPaqueteId({paqueteId})`; `setDescuento({descuento})`; `setFechaInicio({fechaInicio})` — cada uno cambia SOLO su campo (asertar los otros intactos)
- `reset()` vuelve al initialState: asertar `listaPaquetes: []`, `paqueteId: 0`, `descuento: 0` y que `fechaInicio` cumple `/^\d{4}-\d{2}-\d{2}$/` (se computa con new Date() al cargar el módulo — si el initialState está exportado, comparar contra él directamente)

**Selectors** (vía `.projector(...)` — puros, sin Store):
- `selectPaqueteActual`: encuentra por id robusto (`idPaquete`/`paqueteId`/`id`/`id_paquete`) → armar 2 fixtures PaqueteData (usar `idPaquete`) y asertar match y `null` si no existe
- `selectPrecioPaquete`: `Number(p?.precio)||0` → con paquete null da 0
- `selectCostoInscripcion`: ídem con costoInscripcion
- `selectTotalVista`: usa `calcularTotal(precio, descuento, costoInscripcion)` → ej. precio 500, desc 100, insc 150 → 550
- `selectTotalSinDescuento`: `calcularTotal(precio, 0, insc)` → 650
- `selectFechaPagoVista`: usa `calcularFechaFin(fechaInicio, tiempo)` → con '2026-03-10' + paquete `tiempo: TiempoPlan.MENSUAL` → '2026-04-10'

- [ ] Leer los 4 archivos de state + escribir el spec
- [ ] `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -3` → SUCCESS, reportar total
- [ ] Commit:

```bash
git add src/app/pages/inscripcion/state/inscripcion-state.spec.ts
git commit -m "test(): cubrir reducer y selectors de inscripcion (base para migracion a signals)"
```

---

### Task 3: Estado NgRx de reinscripción (asimetrías AS-IS)

**Files:**
- Test (create): `src/app/pages/reinscripcion/state/reinscripcion-state.spec.ts`

Mismo esquema que Task 2 (leer `src/app/pages/reinscripcion/state/` primero), con las asimetrías documentadas con comentarios `// AS-IS (negocio): ...`:
- `selectPaqueteActual` solo matchea por `idPaquete` (menos robusto que inscripción)
- NO existe `selectCostoInscripcion`
- `selectTotalSinDescuento` = precio crudo (sin inscripción, sin redondeo)
- `selectTotalVista` = `Math.max(0, precio - descuento)` inline — SIN costo de inscripción (reinscripción no cobra inscripción)
- `selectFechaPagoVista` devuelve `fechaInicio` SIN transformar (no usa calcularFechaFin)

- [ ] Leer + escribir el spec
- [ ] Correr tests → SUCCESS, reportar total
- [ ] Commit:

```bash
git add src/app/pages/reinscripcion/state/reinscripcion-state.spec.ts
git commit -m "test(): cubrir reducer y selectors de reinscripcion (asimetrias de negocio documentadas)"
```

---

### Task 4: Helpers puros de ticket-service

**Files:**
- Test (create): `src/app/services/ticket-service.spec.ts` (primera parte)

`TicketService` se instancia con `TestBed.inject(TicketService)` (verificar si tiene deps en el constructor — leer la clase). Los helpers son privados → bracket-access con comentario justificativo al inicio:

```typescript
// Los helpers son privados; se accede por índice ('money') porque la Fase 5 los extraerá
// a funciones exportadas y estos tests serán su red de seguridad. NO tocar el servicio.
```

Contratos (verificados; el fuente gana):
- `money(1500)` → `'$1,500.00'`; `money(0)` → `'$0.00'`; `money(NaN)` → `'$0.00'` (Intl MXN sin espacios)
- `escape('<a>&"')` → `'&lt;a&gt;&amp;&quot;'`; `escape(null)` → `''`
- `toNum('12.5')` → 12.5; `toNum('x')` → 0; `toNum(null)` → 0
- `toInt('3.9')` → 3; `toInt('x')` → 0; `toInt(2.7)` → 2.7 (AS-IS: números pasan sin floor — documentar)
- `pickNum(0,5)` → 5; `pickNum(3,5)` → 3; `pickNum(-1,5)` → 5
- `calcularSubtotal([{nombre:'X', cantidad:2, precioUnit:50}])` → 100; `[]` → 0
- `normalizarItemsDesdeBackend({detalles:[{cantidad:2, producto:{nombre:'X', precioVenta:10}}]})` → `[{nombre:'X', cantidad:2, precioUnit:10}]`; sin detalles → `[]`; sin precioVenta usa `subTotal/cantidad`
- `normalizarPagosVentaDesdeBackend({pagos:[{tipoPago:'EFECTIVO', monto:100}]})` → `[{metodo:'EFECTIVO', monto:100}]`; pagos vacíos → `undefined`; filtra monto <= 0
- `normalizeMetodoPago('Crédito')` → 'TARJETA'; `('SPEI')` → 'TRANSFERENCIA'; `('cortesía')` → 'OTRO'; `('EFECTIVO')` → 'EFECTIVO'
- `sumarPagosPorMetodo([{tipoPago:'VISA', total:50},{metodo:'CASH', total:20}])` → `{EFECTIVO:20, TARJETA:50, TRANSFERENCIA:0, OTRO:0}` (verificar el mapeo exacto de 'VISA' y 'CASH' en el fuente antes de asertar)
- `sumarPorOrigen('VENTA', [{origen:'venta', total:30}])` → 30 (case-insensitive)
- `sumarEfectivo([{tipoPago:'Efectivo', total:40},{tipoPago:'Tarjeta', total:10}])` → 40
- `docId('FOLIO', 123)` → contiene `<span class="lbl">FOLIO</span>` y `<span>123</span>`; `docId('FOLIO','')` → `''`
- `pagoLabelCorto('EFECTIVO')` → 'EFEC'; `('Transferencia')` → 'TRASF'
- `renderBloquePagos(undefined, [{metodo:'EFECTIVO', monto:100}], undefined, 'PAGOS')` → contiene 'PAGOS', 'EFECTIVO' y '$100.00' (verificar la firma exacta en el fuente)

- [ ] Leer ticket-service.ts (secciones de helpers) + escribir esta parte del spec
- [ ] Correr tests → SUCCESS, reportar total
- [ ] Commit:

```bash
git add src/app/services/ticket-service.spec.ts
git commit -m "test(): cubrir helpers puros de ticket-service (dinero, normalizacion y desglose)"
```

---

### Task 5: Builders de HTML de ticket-service

**Files:**
- Modify: `src/app/services/ticket-service.spec.ts` (agregar describes)

Los `private htmlX(...)` devuelven strings puros (leen `localStorage` solo para estilos con fallback — hacer `localStorage.clear()` en beforeEach). Asertar por SUBSTRINGS (no igualdad completa):

- `htmlVenta(d: TicketVenta)`: armar un `d` mínimo (leer el tipo en el fuente: items normalizados, total, folio, contexto negocio/cajero, fecha EXPLÍCITA) → el HTML contiene: nombre del negocio, folio, `x2` (cantidad), `$1,500.00` (o el money del total del fixture), nombre del cajero, `¡Gracias por su compra!`, `ESTE NO ES UN COMPROBANTE FISCAL`
- `htmlMembresia(d: TicketMembresia)`: contiene el concepto (ej. 'Membresía MENSUAL'), `TOTAL A PAGAR`, `*** PAGADO ***`, y `ENTRENADOR:` solo cuando se setea (2 tests: con y sin entrenador)
- `htmlCorte(d, brandTitle)`: armar el DTO mínimo (leer tipo) → contiene `::: CORTE DE CAJA :::`, `CORTE #`, `TIPOS DE INGRESOS`, `FORMAS DE PAGO`, y el `money(d.totales.general)`
- Un test de inyección: item con nombre `<script>alert(1)</script>` → el HTML contiene `&lt;script&gt;` y NO contiene `<script>alert` (verifica que escape() se aplica)

- [ ] Leer los tipos TicketVenta/TicketMembresia/corte en el fuente + escribir
- [ ] Correr tests → SUCCESS, reportar total
- [ ] Commit:

```bash
git add src/app/services/ticket-service.spec.ts
git commit -m "test(): cubrir builders de html de tickets (venta, membresia, corte y escape)"
```

---

### Task 6: preferencias-usuario y layout-ui-service

**Files:**
- Test (create): `src/app/util/preferencias-usuario.spec.ts`
- Test (create): `src/app/services/layout-ui.service.spec.ts`

**preferencias-usuario** (localStorage.clear() en beforeEach/afterEach; key `ra_user_preferences_v1`):
- `loadPreferenciasUsuario()` sin nada guardado → `{avatarStyle:'azul', fraseHome:'clasica'}` (default)
- localStorage con JSON corrupto (`'###'`) → default (sin throw)
- save + load roundtrip conserva valores válidos (`{avatarStyle:'sticker_rayo', fraseHome:'motivar'}`)
- localStorage con valores inválidos (`{"avatarStyle":"neon","fraseHome":"x","extra":1}`) → load devuelve saneado `{avatarStyle:'azul', fraseHome:'clasica'}` sin la key extra
- `avatarColorByStyle('rojo')` → `'#C1121F'` (verificar el hex en fuente)
- `avatarImageByStyle('sticker_rayo')` → `'avatares/sticker-rayo.svg'`; `('azul')` → null
- `fraseHomeByMode('motivar')` → string no vacío Y estable: dos llamadas seguidas devuelven lo mismo (mismo día); modo inválido (`'zzz' as FraseHomeMode`... NO — sin casts prohibidos: usar los 3 modos válidos y asertar que cada uno devuelve string no vacío)

**layout-ui.service** (signals): `sidebarOpen` inicia con su valor default (leer fuente), `open()` → true, `close()` → false, `toggle()` alterna.

- [ ] Leer ambos fuentes + escribir los 2 specs
- [ ] Correr tests → SUCCESS, reportar total
- [ ] Commit:

```bash
git add src/app/util/preferencias-usuario.spec.ts src/app/services/layout-ui.service.spec.ts
git commit -m "test(): cubrir preferencias de usuario (sanitizado y storage) y layout-ui"
```

---

### Task 7: Verificación final de la Fase 2 completa

- [ ] `npm run verificar` → TODO SUCCESS + build con las 2 warnings conocidas
- [ ] `git log --oneline main..HEAD && git diff main --stat | tail -3` → ~5 commits, solo specs
- [ ] Reporte final: total de tests, y confirmación de que la Fase 2 del spec queda CERRADA: utilidades ✓ (2a), servicios ✓ (2a+2b), lógica de flujos ✓ (2a carrito + 2c ticket), reducers/selectors ✓ (2c). Único hueco declarado restante: `generic-service.ts` (cubierto indirectamente por 20+ extenders).

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 2, bullet 3 y 4):** reducers/selectors de ambos states ✓ (Tasks 2-3, con las asimetrías del negocio documentadas), lógica de ticket ✓ (Tasks 4-5: helpers + builders con test de escape/inyección), preferencias y layout-ui ✓ (Task 6, cierra los "opcionales" declarados en 2b).
- **Placeholders:** contratos con ejemplos entrada→salida concretos del catálogo leído del fuente (2026-07-09); las instrucciones "leer el fuente primero / el fuente gana" son la salvaguarda AS-IS.
- **Decisión técnica documentada:** bracket-access a privados de ticket-service es deliberado y transitorio (Fase 5 los exporta); alternativa (testear solo vía públicos) es imposible porque todos los públicos tocan window.
- **Consistencia:** nombres de helpers/selectors tomados del catálogo del fuente; los de `sumarPagosPorMetodo`/`renderBloquePagos` marcados para verificación extra porque sus firmas son las más propensas a variar.
