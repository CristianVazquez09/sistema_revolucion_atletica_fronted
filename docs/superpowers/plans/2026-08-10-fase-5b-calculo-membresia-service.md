# Fase 5b — `calculo-membresia`: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Goal:** Construir un módulo de funciones puras (`calculo-membresia.ts`, mismo estilo que `shared/util/fechas-precios.ts`) que consolide la lógica de selección de promociones, cálculo de descuentos, extensión de vigencia y validación de paquete estudiantil — hoy implementada 3 veces de forma independiente e inconsistente en `inscripcion.ts`, `reinscripcion.ts` y `reinscripcion-adelantada.ts`. **A diferencia de la Fase 5a (salida de NgRx), esta oleada SÍ cambia comportamiento real de forma deliberada** — las decisiones de negocio ya fueron tomadas explícitamente por el usuario, están documentadas abajo, y NO son negociables durante la implementación (si algo no encaja con lo decidido, se detiene y se reporta, no se improvisa).

**Architecture:** Segunda sub-oleada de la Fase 5. La Fase 5a (salida de NgRx) ya está mergeada — `InscripcionStore`/`ReinscripcionStore` existen y siguen siendo la fuente de estado crudo (`listaPaquetes`, `paqueteId`, `descuento`, `fechaInicio`); esta oleada NO los modifica, solo agrega una nueva capa de cálculo que los componentes consumen junto con el estado del store.

## Decisiones de negocio ya tomadas (NO renegociables en esta oleada)

1. **Selección de "mejor promoción" — por `prioridad`** (el campo que ya configura el administrador por promoción), no por valor monetario. Empate: mayor `idPromocion` gana (promoción más reciente). Esto iguala el comportamiento de `inscripcion.ts` al de `reinscripcion.ts` — es `inscripcion.ts` el que cambia de comportamiento aquí, `reinscripcion.ts` ya lo hacía así.
2. **Reinscripción adelantada SÍ debe soportar promociones** — hoy no tiene ninguna lógica de promociones (ni fetch, ni selección, ni descuento). Se le agrega el mismo pipeline que las otras 2 pantallas.
3. **"Meses gratis" se implementa de verdad** — hoy se muestra como beneficio activo pero no baja el precio ni extiende la vigencia en ninguna pantalla. Ahora debe extender la fecha de fin de vigencia por la cantidad de meses prometida (no afecta el precio — es tiempo gratis, no dinero).
4. **Regla de paquete estudiantil — SOLO la bandera explícita** (`paquete.estudiantil === true`), igual que `inscripcion.ts` hoy. `reinscripcion.ts` hoy usa una detección más amplia (nombre contiene "estudiant" O `tipoPaquete` contiene "ESTUD") — **se elimina esa heurística extra**, queda solo la bandera. Esta regla (edad ≤22 + credencial vigente y no vencida) se aplica de forma consistente en las 3 pantallas — `reinscripcion-adelantada.ts` hoy no la tiene en absoluto, se le agrega.

## Correcciones técnicas derivadas (consecuencia directa de lo anterior, no decisiones nuevas)

5. **`fechaPagoVista` de reinscripción hoy solo repite la fecha de inicio** (bug documentado y dejado a propósito en la Fase 5a). Se corrige para que calcule la fecha de fin real (`calcularFechaFin` + extensión por meses gratis si aplica), igual que las otras 2 pantallas.
6. **El descuento manual negativo no está bloqueado en `reinscripcion.ts`** (si en `inscripcion.ts`/`reinscripcion-adelantada.ts` sí lo está) — se agrega el mismo `Math.max(0, v)` en las 3 pantallas.
7. **El total se calcula con 3 fórmulas distintas hoy** (`inscripcion.ts` usa `calcularTotal()`; `reinscripcion.ts`/`reinscripcion-adelantada.ts` lo reimplementan a mano con técnicas de redondeo distintas) — las 3 pasan a usar la misma función del nuevo módulo, que internamente sigue llamando a `calcularTotal()` de `fechas-precios.ts` (esa función NO se toca, ya está probada).
8. **El "congelado" parcial del pago en `inscripcion.ts`** (el total mostrado al cajero se congela al abrir el resumen, pero el descuento enviado al backend se recalcula en el momento de confirmar) se unifica a lectura 100% en vivo — mismo criterio que ya usan `reinscripcion.ts`/`reinscripcion-adelantada.ts` (más simple, sin el riesgo de desincronización).
9. **`sinCostoInscripcion` de una promoción no debe descalificarla por completo** en un contexto sin costo de inscripción (reinscripción) — hoy `reinscripcion.ts` excluye la promoción ENTERA si tiene `sinCostoInscripcion: true`, aunque también tenga un `descuentoPorcentaje`/`descuentoMonto` real. La nueva función de elegibilidad solo excluye por `soloNuevos` en contexto de renovación; `sinCostoInscripcion` se vuelve un componente independiente del beneficio (útil en inscripción, sin efecto — no descalificante — en renovaciones).

## Investigación previa (hecha antes de escribir este plan)

Catálogo exhaustivo de las 3 implementaciones (agente de exploración, código citado textual) — ver `docs/superpowers/plans/2026-08-10-fase-5b-calculo-membresia-service.md` (este archivo) para las decisiones; el detalle línea por línea de cada método viejo está en las Tasks 3-5 de abajo, citado de nuevo ahí para que el implementador no tenga que re-descubrirlo.

**Modelo real de promoción** (`src/app/shared/models/promocion-data.ts`):
```typescript
interface PromocionData {
  idPromocion: number;
  tipo: TipoPromocion | string; // DESCUENTO_PORCENTAJE | DESCUENTO_MONTO | MESES_GRATIS | SIN_BENEFICIO
  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  mesesGratis?: number | null;
  soloNuevos?: boolean;
  sinCostoInscripcion?: boolean;
  prioridad?: number;
  activo: boolean;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
}
```

**Funciones puras ya existentes que NO se tocan** (`src/app/shared/util/fechas-precios.ts`):
- `calcularTotal(precioPaquete, descuento, costoInscripcion): number` — `Math.max(0, precio + costoInscripcion - descuento)`, redondeado a 2 decimales.
- `calcularFechaFin(inicioISO, tiempo): string` — suma la duración del plan a la fecha de inicio.
- `hoyISO(): string`.

**Fetch de promociones** (ya existe, reutilizable en las 3 pantallas): `PaqueteService.buscarPromocionesVigentes(idPaquete)` (`src/app/features/administracion/data/paquete-service.ts`), ya inyectado en `inscripcion.ts`/`reinscripcion.ts`; `reinscripcion-adelantada.ts` ya inyecta `PaqueteService` (para `buscarTodos()`) pero no llama a este método todavía.

**Tech Stack:** Angular 20 standalone, funciones puras (sin `@Injectable`, mismo estilo que `fechas-precios.ts`), Karma + Jasmine.

**Reglas transversales:**
- Esta oleada SÍ cambia comportamiento — cada cambio está enumerado arriba (puntos 1-9). Si el implementador encuentra un comportamiento divergente NO listado arriba, se detiene y reporta — no lo "arregla" por su cuenta ni lo dispara como si fuera parte de la lista.
- Gates por task: `npx tsc -p tsconfig.app.json --noEmit`, `npx tsc -p tsconfig.spec.json --noEmit`, `npx ng test --watch=false --browsers=ChromeHeadless` (base 494), `npm run build:web`.
- ⚠️ Commits: español, una línea, `feat():`/`refactor():`/`fix():`, SIN trailer de coautoría. Verificar con `git log -1 --format=%B` tras cada commit.
- Nunca commitear `.claude/settings.local.json`.
- Dado que esta oleada toca dinero real, cada task se revisa comparando el código viejo contra el nuevo fórmula por fórmula, y además confirmando que el comportamiento nuevo coincide EXACTAMENTE con las 9 decisiones de arriba (ni más, ni menos cambios).

---

### Task 1: Rama y línea base

- [ ] `git checkout main && git checkout -b feat/fase-5b-calculo-membresia`
- [ ] `npm run test:ci 2>&1 | tail -3` → `494 SUCCESS`. Si no, DETENTE.

---

### Task 2: Construir `calculo-membresia.ts` (funciones puras) + tests exhaustivos

**Files:**
- Create: `src/app/features/inscripciones/data/calculo-membresia.ts`
- Create: `src/app/features/inscripciones/data/calculo-membresia.spec.ts`

**Diseño** (nombres en español, funciones puras — sin estado, sin inyección, mismo estilo que `fechas-precios.ts`):

```typescript
import { PromocionData } from '../../../shared/models/promocion-data';
import { TipoPromocion } from '../../../shared/util/enums/tipo-promocion';
import { calcularFechaFin, calcularTotal } from '../../../shared/util/fechas-precios';

/** ¿La promoción está vigente hoy según su rango de fechas? (activo se
 * revisa aparte, esta función solo mira fechaInicio/fechaFin). */
export function promoVigente(promo: PromocionData, hoyISO: string): boolean {
  const ini = String(promo?.fechaInicio ?? '').split('T')[0];
  const fin = String(promo?.fechaFin ?? '').split('T')[0];
  if (ini && hoyISO < ini) return false;
  if (fin && hoyISO > fin) return false;
  return true;
}

export interface OpcionesElegibilidadPromo {
  /** true en reinscripción/reinscripción adelantada — excluye promos "solo nuevos". */
  esRenovacion: boolean;
  hoyISO: string;
}

/** Elige la "mejor" promoción entre las activas+vigentes+elegibles, por
 * `prioridad` DESC (mayor prioridad gana), empate por `idPromocion` DESC
 * (la más reciente gana). Decisión de negocio: prioridad, NO valor
 * monetario — ver plan Fase 5b, punto 1. */
export function elegirMejorPromocion(
  promos: PromocionData[],
  opciones: OpcionesElegibilidadPromo,
): PromocionData | null {
  const elegibles = (promos ?? [])
    .filter((p) => p && p.activo !== false)
    .filter((p) => promoVigente(p, opciones.hoyISO))
    .filter((p) => !(opciones.esRenovacion && p.soloNuevos === true));

  if (!elegibles.length) return null;

  const ordenadas = [...elegibles].sort((a, b) => {
    const pa = Number(a.prioridad ?? 0);
    const pb = Number(b.prioridad ?? 0);
    if (pa !== pb) return pb - pa;
    return Number(b.idPromocion ?? 0) - Number(a.idPromocion ?? 0);
  });

  return ordenadas[0];
}

export interface BeneficioPromo {
  descuentoMonto: number; // pesos a restar del precio del paquete
  exentoCostoInscripcion: boolean;
  mesesGratis: number; // meses a sumar a la vigencia
}

/** Traduce una promoción (o ninguna) a sus 3 componentes de beneficio,
 * independientes entre sí (una promo puede dar descuento en dinero Y
 * exentar el costo de inscripción Y dar meses gratis — no son excluyentes). */
export function calcularBeneficioPromo(
  promo: PromocionData | null,
  precioPaquete: number,
): BeneficioPromo {
  if (!promo) return { descuentoMonto: 0, exentoCostoInscripcion: false, mesesGratis: 0 };

  const tipo = String(promo.tipo ?? '').toUpperCase();
  let descuentoMonto = 0;

  if (tipo === TipoPromocion.DESCUENTO_PORCENTAJE) {
    const pct = Number(promo.descuentoPorcentaje ?? 0);
    if (pct > 0) descuentoMonto = (Math.max(0, precioPaquete) * pct) / 100;
  } else if (tipo === TipoPromocion.DESCUENTO_MONTO) {
    descuentoMonto = Math.max(0, Number(promo.descuentoMonto ?? 0));
  }

  const mesesGratis =
    tipo === TipoPromocion.MESES_GRATIS ? Math.max(0, Number(promo.mesesGratis ?? 0)) : 0;

  return {
    descuentoMonto: Math.round(descuentoMonto * 100) / 100,
    exentoCostoInscripcion: promo.sinCostoInscripcion === true,
    mesesGratis,
  };
}

export interface ParametrosTotalMembresia {
  precioPaquete: number;
  costoInscripcion: number; // 0 en renovaciones
  descuentoManual: number;
  promo: PromocionData | null;
}

export interface ResultadoTotalMembresia {
  total: number;
  descuentoTotal: number; // manual + promo, para mostrar desglosado
  beneficioPromo: BeneficioPromo;
}

/** Combina descuento manual + beneficio de promo + costo de inscripción
 * (exento si la promo lo exenta) en un solo total, vía la función pura
 * calcularTotal() ya existente y probada. Clampa el descuento manual a
 * >= 0 (nunca debe poder INFLAR el total). */
export function calcularTotalMembresia(params: ParametrosTotalMembresia): ResultadoTotalMembresia {
  const precio = Math.max(0, Number(params.precioPaquete) || 0);
  const descuentoManual = Math.max(0, Number(params.descuentoManual) || 0);
  const beneficioPromo = calcularBeneficioPromo(params.promo, precio);

  const costoInscripcionEfectivo = beneficioPromo.exentoCostoInscripcion
    ? 0
    : Math.max(0, Number(params.costoInscripcion) || 0);

  const descuentoTotal =
    Math.round((descuentoManual + beneficioPromo.descuentoMonto) * 100) / 100;

  const total = calcularTotal(precio, descuentoTotal, costoInscripcionEfectivo);

  return { total, descuentoTotal, beneficioPromo };
}

/** Fecha de fin de vigencia, incluyendo la extensión por meses gratis de
 * una promo (si aplica). NO modifica calcularFechaFin() — la compone. */
export function calcularFechaFinConBeneficio(
  fechaInicioISO: string,
  tiempo: unknown,
  mesesGratis: number,
): string {
  const finBase = calcularFechaFin(fechaInicioISO, tiempo as any);
  if (!mesesGratis || mesesGratis <= 0) return finBase;

  const d = new Date(finBase + 'T00:00:00');
  d.setMonth(d.getMonth() + mesesGratis);
  return d.toISOString().slice(0, 10);
}

export interface ParametrosValidacionEstudiantil {
  esPaqueteEstudiantil: boolean; // SOLO paquete.estudiantil === true, sin heurísticas de nombre/tipo
  fechaNacimientoISO: string | null;
  credencialVigenciaISO: string | null;
  hoyISO: string;
  calcularEdad: (fechaNacimientoISO: string, hoyISO: string) => number;
}

export interface ResultadoValidacionEstudiantil {
  valido: boolean;
  motivo?: string;
}

/** Valida edad <=22 y credencial vigente (no vencida) para paquetes
 * estudiantiles. Pura — el componente que la llama decide cómo mostrar
 * `motivo` (ej. this.notificacion.error(resultado.motivo)). Si el paquete
 * no es estudiantil, siempre válido (no aplica ninguna regla). */
export function validarPaqueteEstudiantil(
  params: ParametrosValidacionEstudiantil,
): ResultadoValidacionEstudiantil {
  if (!params.esPaqueteEstudiantil) return { valido: true };

  if (!params.fechaNacimientoISO) {
    return { valido: false, motivo: 'Para paquete estudiantil se requiere fecha de nacimiento.' };
  }

  const edad = params.calcularEdad(params.fechaNacimientoISO, params.hoyISO);
  if (edad > 22) {
    return { valido: false, motivo: `Paquete estudiantil solo aplica hasta 22 años. Edad actual: ${edad}.` };
  }

  if (!params.credencialVigenciaISO) {
    return { valido: false, motivo: 'Para paquete estudiantil se requiere la vigencia de la credencial.' };
  }

  if (params.credencialVigenciaISO < params.hoyISO) {
    return {
      valido: false,
      motivo: `Credencial de estudiante vencida (vigencia: ${params.credencialVigenciaISO}).`,
    };
  }

  return { valido: true };
}
```

⚠️ El implementador debe verificar este boceto contra las citas textuales de las Tasks 3-5 (más abajo) antes de darlo por bueno — es una guía de diseño, no código final garantizado libre de errores. Prestar atención especial a: `calcularEdad` se pasa como parámetro en vez de importarla, porque la lógica real de cálculo de edad (`calcularEdadDesdeISO` en `inscripcion.ts`) ya existe y debe reutilizarse tal cual (moverla a este módulo como función exportada adicional si tiene sentido, o dejarla donde está e inyectarla como callback — decidir al implementar, documentando la decisión).

- [ ] **Step 1:** Crear `calculo-membresia.ts` con el diseño de arriba (ajustado tras verificar contra el código real).
- [ ] **Step 2:** Crear `calculo-membresia.spec.ts` — cobertura exhaustiva dado que esto es dinero real:
  - `promoVigente`: antes del rango, dentro del rango, después del rango, sin fechaInicio, sin fechaFin.
  - `elegirMejorPromocion`: vacío → null; una sola → esa; empate de prioridad → gana mayor idPromocion; prioridad distinta → gana mayor prioridad (**incluyendo el caso exacto del ejemplo real del negocio: promo A prioridad=10/5%=$25 vs promo B prioridad=1/50%=$250 sobre paquete de $500 → debe ganar A ($25), no B**); promo inactiva excluida; promo fuera de vigencia excluida; `esRenovacion=true` excluye `soloNuevos=true`; `esRenovacion=true` NO excluye por `sinCostoInscripcion=true` si el resto la hace elegible.
  - `calcularBeneficioPromo`: cada tipo (PORCENTAJE/MONTO/MESES_GRATIS/SIN_BENEFICIO/null), `sinCostoInscripcion` independiente del tipo de descuento, `mesesGratis` en 0 cuando el tipo no es MESES_GRATIS.
  - `calcularTotalMembresia`: descuento manual negativo se clampa a 0 (no infla el total); promo + manual se suman; `exentoCostoInscripcion` pone costoInscripcion en 0; caso completo con paquete+promo%+descuento manual coincidiendo con un ejemplo trabajado a mano.
  - `calcularFechaFinConBeneficio`: sin mesesGratis (pasa igual que `calcularFechaFin`); con mesesGratis suma meses extra sobre la fecha ya calculada, no sobre la fecha de inicio original.
  - `validarPaqueteEstudiantil`: paquete no estudiantil → siempre válido; estudiantil sin fecha nacimiento → inválido con motivo; edad ≤22 con credencial vigente → válido; edad >22 → inválido; credencial vencida → inválido; credencial en null → inválido.
- [ ] **Step 3:** Gates: tsc app/spec, tests (494 + los nuevos), build.
- [ ] **Step 4:** Commit:

```bash
git add src/app/features/inscripciones/data/calculo-membresia.ts src/app/features/inscripciones/data/calculo-membresia.spec.ts
git commit -m "feat(): construir calculo-membresia (promociones, descuentos, vigencia y regla estudiantil unificados)"
```
Verificar sin trailer.

---

### Task 3: Migrar `inscripcion.ts` (Flujo A) a `calculo-membresia`

**Files:**
- `src/app/features/inscripciones/pages/inscripcion/inscripcion.ts`

Leer COMPLETO antes de tocar (puede haber cambiado desde este plan). Reemplazar:
- `scorePromo`/`seleccionarMejorPromocion`/`promoVigenteHoy` → llamadas a `elegirMejorPromocion`/`promoVigente` del nuevo módulo (`esRenovacion: false`). **Esto cambia de comportamiento a propósito** (decisión 1: pasa de elegir por valor monetario a elegir por `prioridad`) — no es un bug a preservar.
- `descuentoPromoSnapshot`/`snapshotCobroActual` y el mecanismo de congelado parcial (`*EnModalSig`) → unificar a lectura 100% en vivo de `calcularTotalMembresia(...)`, tanto para lo que se muestra en el modal de resumen como para lo que se envía al backend al confirmar (decisión 8 — mismo criterio que ya usan reinscripción/reinscripción adelantada).
- `validarPaqueteEstudiantilUI` → llamar a `validarPaqueteEstudiantil(...)` del nuevo módulo, pasando `esPaqueteEstudiantil: paquete?.estudiantil === true` (ya es así en esta pantalla, sin heurísticas extra — no cambia aquí). El componente sigue mostrando el error vía `this.notificacion.error(resultado.motivo)`.
- `calcularEdadDesdeISO` → decidir si se mueve al nuevo módulo (recomendado, para que las 3 pantallas la compartan) o se pasa como callback — seguir lo decidido en Task 2.
- La fecha de fin (`fechaPagoVista` del store) debe pasar a considerar los meses gratis de la promo elegida — usar `calcularFechaFinConBeneficio(...)` en vez de solo `calcularFechaFin(...)` donde corresponda mostrar/guardar la fecha de fin real.

⚠️ Verificar con cuidado el flujo completo: elegir promo → `calcularBeneficioPromo`/`calcularTotalMembresia` → mostrar en resumen → confirmar pago → payload al backend. Todo debe leer de la MISMA fuente en vivo, sin ningún signal `*EnModalSig` congelado sobreviviendo aparte.

## Gates: tsc app/spec, tests, build.

## Commit

```bash
git add -A
git commit -m "refactor(): migrar inscripcion.ts a calculo-membresia (promo por prioridad, meses gratis, total en vivo)"
```
Verificar sin trailer.

---

### Task 4: Migrar `reinscripcion.ts` (Flujo B) a `calculo-membresia`

**Files:**
- `src/app/features/inscripciones/pages/reinscripcion/reinscripcion.ts`

Leer COMPLETO antes de tocar. Reemplazar:
- `elegirMejorPromo`/`promoEsValidaParaReinscripcion` → `elegirMejorPromocion(..., { esRenovacion: true, hoyISO })`. El resultado de SELECCIÓN no debería cambiar en la mayoría de los casos (esta pantalla ya elegía por prioridad), pero la elegibilidad SÍ cambia: una promo con `sinCostoInscripcion: true` que antes se descartaba por completo ahora puede elegirse si tiene además descuento real (decisión 9).
- `descuentoDePromo` → `calcularBeneficioPromo(...)`.
- El cálculo de total hecho a mano (`round2(Math.max(0, precioConPromo - descManual))`) → `calcularTotalMembresia(...)` (decisión 7 — usa `calcularTotal()` por dentro, con `costoInscripcion: 0` ya que reinscripción no cobra inscripción).
- El descuento manual sin clamp (`form.controls.descuento.valueChanges` → `establecerDescuento(Number(d ?? 0))` directo) → clampar a `Math.max(0, ...)` antes de guardar en el store (decisión 6). Revisar también si el `<input>` de descuento en `reinscripcion.html` necesita `min="0"` para reforzarlo en la UI (no solo en el código).
- `ReinscripcionStore.fechaPagoVista` (el echo de `fechaInicio`) — dado que `ReinscripcionStore` es de la Fase 5a y no se toca en esta oleada, la corrección se hace EN `reinscripcion.ts`: dejar de usar `fechaPagoVistaSig = this.store.fechaPagoVista` directamente para el campo de "vigencia hasta", y en su lugar calcular un nuevo signal local con `calcularFechaFinConBeneficio(this.store.fechaInicio(), paqueteActual?.tiempo, mesesGratisDeLaPromoElegida)`, usado donde el template hoy muestra la fecha de vigencia. Verificar el nombre real del campo/label en `reinscripcion.html` antes de decidir el nombre del nuevo signal.
- Agregar la validación de paquete estudiantil (`validarPaqueteEstudiantil(...)`, `esPaqueteEstudiantil: paquete?.estudiantil === true` — **sin** la heurística de nombre/tipo que esta pantalla tiene hoy, decisión 4) donde corresponda en el flujo de confirmación de pago (buscar el equivalente de `validarPaqueteEstudiantilUI` de `inscripcion.ts`, o agregar el punto de validación si no existe uno explícito hoy en esta pantalla — confirmar si `reinscripcion.ts` ya valida esto en algún punto antes de asumir que hay que agregarlo desde cero).

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "refactor(): migrar reinscripcion.ts a calculo-membresia (elegibilidad de promo, fecha de vigencia real, clamp de descuento)"
```
Verificar sin trailer.

---

### Task 5: Migrar `reinscripcion-adelantada.ts` (Flujo C) a `calculo-membresia` — agregar soporte de promociones desde cero

**Files:**
- `src/app/features/inscripciones/pages/inscripcion/reinscripcion-adelantada/reinscripcion-adelantada.ts`

Leer COMPLETO antes de tocar. Esta pantalla hoy **no tiene ninguna lógica de promociones** — es la tarea más grande de las 3 porque agrega funcionalidad nueva, no solo migra la existente.

- Agregar el fetch de promociones: `this.paqueteSrv.buscarPromocionesVigentes(idPaquete)` (mismo servicio ya inyectado, mismo método que usan `inscripcion.ts`/`reinscripcion.ts`) — disparado cuando cambia el paquete seleccionado, con sus propios signals de estado (`promocionesVigentesSig`, `promoCargandoSig`, `promoErrorSig` — nombres a decidir siguiendo la convención ya usada en las otras 2 pantallas).
- Agregar la selección: `elegirMejorPromocion(promos, { esRenovacion: true, hoyISO })`.
- Agregar el cálculo de beneficio/total: `calcularBeneficioPromo`/`calcularTotalMembresia`, reemplazando el `totalPorSocioSig` hecho a mano (`Math.max(0, Number((precio - descuento).toFixed(2)))`) por la función unificada.
- Agregar el descuento manual con clamp (`Math.max(0, ...)`) si no lo tiene ya (el research previo indica que SÍ lo tiene vía `normalizarMonto()` — verificar y confirmar, no asumir que hay que agregarlo).
- La fecha de fin (`fechaFinNuevaIsoSig`) ya encadena correctamente desde `vigentePrincipal.fechaFin + 1 día` (este es el ÚNICO de los 3 flujos que lo hace bien) — **no tocar esa parte**, solo agregar la extensión por meses gratis encima: `calcularFechaFinConBeneficio(fechaInicioNuevaIsoSig(), paquete.tiempo, mesesGratisDeLaPromoElegida)` en vez de la llamada directa a `calcularFechaFin(...)` que tiene hoy.
- Agregar la validación de paquete estudiantil (`validarPaqueteEstudiantil(...)`, `esPaqueteEstudiantil: paquete?.estudiantil === true`) en el punto de confirmación de pago — esta pantalla no la tiene hoy en absoluto, agregar el punto de validación completo (form fields de fecha de nacimiento/credencial-vigencia si no existen ya en el formulario de esta pantalla — verificar, puede que falten campos de captura y haya que agregarlos a la UI también, no solo la validación).
- Actualizar `reinscripcion-adelantada.html` para: mostrar la promoción aplicada (si existe) igual que las otras 2 pantallas muestran su badge/resumen de promo; mostrar el desglose de descuento (manual + promo); si se agregan campos de fecha de nacimiento/credencial-estudiante, agregarlos al formulario visible solo cuando el paquete sea estudiantil (igual patrón condicional que las otras 2 pantallas).

⚠️ Esta es la task de mayor superficie nueva — si algo no está claro (ej. si el formulario de esta pantalla genuinamente no captura fecha de nacimiento en absoluto porque es un dato que ya existe del socio original, no de un formulario nuevo), DETENERSE y reportar la ambigüedad en vez de inventar un campo que no aplica al flujo de renovación (a diferencia de inscripción, que es alta de un socio nuevo, reinscripción adelantada es de un socio YA EXISTENTE — sus datos de nacimiento probablemente ya están en el backend, no se recapturan).

## Gates: completos.

## Commit

```bash
git add -A
git commit -m "feat(): agregar soporte de promociones y validacion estudiantil a reinscripcion-adelantada"
```
Verificar sin trailer.

---

### Task 6: Verificación final de la oleada

- [ ] `npm run verificar` → todos los tests SUCCESS + build con las warnings conocidas.
- [ ] Smoke test manual del usuario (`npm run electron:prod`), cubriendo explícitamente los 9 cambios de comportamiento:
  1. Inscripción con 2 promos activas de distinta prioridad → confirmar que gana la de mayor prioridad, no la de mayor descuento en pesos.
  2. Reinscripción adelantada con una promoción activa → confirmar que ahora SÍ se aplica (antes no aplicaba ninguna).
  3. Una promoción de tipo "meses gratis" → confirmar que la fecha de vigencia se extiende la cantidad correcta de meses, en las 3 pantallas donde aplique.
  4. Un paquete marcado como estudiantil (bandera explícita) → confirmar que las 3 pantallas piden fecha de nacimiento/credencial y validan edad ≤22.
  5. Un paquete NO marcado como estudiantil pero con "estudiante" en el nombre → confirmar que reinscripción YA NO exige la validación (antes sí, por la heurística de nombre que se quitó).
  6. Intentar escribir un descuento negativo en reinscripción → confirmar que se bloquea/clampa a 0, no infla el total.
  7. Confirmar que el total mostrado en el resumen de pago de inscripción es exactamente el mismo que se cobra/guarda al confirmar (sin desincronización).
  8. Confirmar que los 3 tickets impresos (inscripción, reinscripción, reinscripción adelantada) muestran montos y fechas de vigencia coherentes con lo calculado en pantalla.
- [ ] Reportar: total real de tests, resumen de qué cambió visiblemente para el cajero/cliente en cada una de las 3 pantallas.

## Self-review (hecho al escribir el plan)

- **Cobertura:** cierra el ítem `calculo-membresia-service` del spec original de Fase 5, resolviendo las 5 inconsistencias/bugs reales encontrados en la investigación previa (selección de promo, meses gratis, adelantada sin promos, descuento negativo, regla estudiantil), más 2 correcciones técnicas derivadas (fecha de vigencia de reinscripción, congelado parcial de inscripción).
- **Riesgo:** el riesgo real es que esta oleada SÍ cambia comportamiento — por eso cada cambio está enumerado y justificado arriba, con un smoke test que verifica explícitamente cada uno, no solo "no rompió nada".
- **Fuera de alcance de 5b:** partir `ticket-service.ts` (siguiente oleada acordada), partir los 3 componentes gigantes en sub-componentes (última oleada acordada) — esta oleada consolida la lógica de cálculo pero NO reduce el tamaño de los archivos `.ts` de forma significativa (siguen siendo componentes grandes, solo con menos lógica de negocio duplicada inline).
