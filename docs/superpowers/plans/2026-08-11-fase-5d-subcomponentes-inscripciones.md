# Fase 5d — sub-componentes de UI para los 3 flujos gigantes

## Alcance decidido

Solo sub-componentes de UI (no se crean stores nuevos ni se mueve lógica de
batch/borrador/envío de pago). Esto reduce cada archivo pero **no** llega a la
meta de "ningún componente >400 líneas" del spec maestro — esa meta requeriría
además mover batch/borrador/envío a stores de signals (fuera de alcance,
decisión explícita del usuario).

## Inventario previo (research, no repetido aquí)

Se hizo un inventario estructural completo de los 3 archivos (clases + templates
+ dependencias + acoplamiento) antes de diseñar el split. Hallazgos clave:

- Los 3 flujos repiten casi textualmente: (a) buscador/dropdown de paquete +
  promo + descuento + tira de precios (~200-230 líneas c/u), (b) selector de
  entrenador RA (~45-65 líneas c/u, la pieza más aislada de las tres — sin
  acoplamiento con paquete/promo/batch).
- `inscripcion.ts` es el único que captura datos de un socio NUEVO (nombre,
  apellido, teléfono, email, fecha nacimiento, dirección, género, comentarios,
  foto) — `reinscripcion.ts`/`reinscripcion-adelantada.ts` solo muestran datos
  de un socio YA existente (solo lectura).
- `reinscripcion.ts` es el único con un modal de remediación de credencial
  estudiantil vencida (~250 líneas: checks por integrante + inputs de nueva
  vigencia + guardado individual). `inscripcion.ts` y `reinscripcion-adelantada.ts`
  solo bloquean con un mensaje, sin modal de remediación.
- La lógica de precio/promo (`calcularTotalMembresia`, `elegirMejorPromocion`,
  `calcularFechaFinConBeneficio` de `calculo-membresia.ts`) varía en los
  parámetros que cada flujo le pasa (esRenovacion true/false, costoInscripcion
  0 vs el del paquete, distinto reset). Por eso el selector de paquete se
  extrae como componente **presentacional puro** (inputs/outputs), sin mover
  ningún cálculo — cada página sigue siendo dueña de sus propios computed de
  precio/promo y se los pasa como `input()` al componente.

## Componentes nuevos (`features/inscripciones/ui/`)

1. **`selector-paquete`** — presentacional. Encapsula: input de búsqueda +
   dropdown de sugerencias, badge de promo (cargando/error/aplicada), input de
   descuento manual, tira de precio (precio/descuento/total). Inputs: lista de
   paquetes sugeridos, paquete seleccionado, texto de búsqueda, flags
   (bloqueado/cargando/dropdown abierto), datos de promo, precio/costo/total ya
   calculados. Outputs: cambios de búsqueda, abrir/cerrar dropdown, seleccionar,
   limpiar, cambio de descuento. Usado por los 3 flujos.

2. **`entrenador-ra-selector`** — semi-smart (inyecta `EntrenadorService`
   directamente y hace su propio fetch, igual que hoy en los 3 archivos, ya que
   la lógica es prácticamente idéntica letra por letra). Input: `esPaqueteRA`
   (gate de visibilidad) + valor seleccionado (model). Output: cambio de
   selección. Usado por los 3 flujos.

3. **`datos-socio-form`** — presentacional, solo `inscripcion.ts`. Los campos
   de captura de un socio nuevo (nombre...comentarios + estudiantil
   credencial) + la captura de foto. Recibe el `FormGroup` como input y expone
   outputs para foto (`fotoSeleccionada`/`quitarFoto`).

4. **`validacion-estudiantil-modal`** — presentacional, solo `reinscripcion.ts`.
   La UI del modal (lista de checks, inputs de nueva vigencia, botones). La
   llamada HTTP real (`socioSrv.actualizar`) y la lógica de generación de
   checks se quedan en `reinscripcion.ts` — el componente solo emite eventos
   (`guardarVigencia`, `cerrar`, `continuar`).

## Fuera de alcance (explícito)

- No se toca `InscripcionStore`/`ReinscripcionStore`.
- No se crea store para `reinscripcion-adelantada.ts`.
- No se mueve lógica de batch, borrador (sessionStorage/localStorage), ni el
  envío final de pago (`confirmarPagoYGuardar`/`guardarTodo`/`persistir`) —
  se queda en cada página.
- No se cambia ningún cálculo de negocio (precio, promo, descuento, fechas).
- La lógica de asesoría nutricional (`reinscripcion.ts` y
  `reinscripcion-adelantada.ts`) NO se extrae en esta fase — no tiene sección
  de UI propia más allá de un badge de estado, así que no encaja en
  "sub-componentes de UI"; queda como posible trabajo futuro.

## Orden de ejecución

1. `entrenador-ra-selector` (el más aislado y sencillo — sirve de calentamiento
   y valida el patrón de extracción antes de tocar el componente más grande).
2. `selector-paquete` (el de mayor impacto en líneas, usado 3x).
3. Adoptar ambos en `inscripcion.ts`.
4. Adoptar ambos en `reinscripcion.ts`.
5. Adoptar ambos en `reinscripcion-adelantada.ts`.
6. `datos-socio-form` + adopción en `inscripcion.ts`.
7. `validacion-estudiantil-modal` + adopción en `reinscripcion.ts`.
8. Revisión final de toda la rama + gates + merge.

## Ajuste de alcance durante la ejecución

Al leer el markup real de `inscripcion.html` (no solo el inventario
estructural previo) se encontró que los campos candidatos a
`datos-socio-form` (nombre...género) SÍ son extraíbles con seguridad, pero el
textarea de "Comentarios" que originalmente se agrupaba junto a ellos en el
inventario en realidad vive como celda hermana de foto/huella/paquete dentro
de un `grid-cols-[...]` de 4 columnas — sacarlo del grid a un componente
aparte arriesga romper el layout responsivo sin un beneficio real (foto y
huella, que sí quedan fuera del componente, seguirían siendo celdas
hermanas). Dado que el usuario pidió explícitamente la opción de **menor
riesgo**, se decidió NO extraer `datos-socio-form` — el ahorro de líneas era
además el más chico de los 4 candidatos (~65 líneas, en un solo archivo).

Se completaron 3 de los 4 componentes planeados:
`entrenador-ra-selector`, `selector-paquete` (ambos usados en los 3 flujos),
y `validacion-estudiantil-modal` (reinscripcion.ts). `datos-socio-form`
queda fuera de alcance por la razón anterior.
