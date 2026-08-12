# Fase 5c — split de ticket-service.ts

## Objetivo (spec línea 172)

> `ticket-service.ts` se parte en: generación de HTML por tipo de ticket como funciones puras + servicio delgado de impresión que habla con Electron.

`ticket-service.ts` actual: 1609 líneas. Único punto de acoplamiento: cálculo de datos del ticket (subtotales, normalización de pagos, formato) mezclado con HTML-string-building mezclado con la plomería de impresión (Electron IPC / `window.open` / descarga de blob).

## Punto de partida ya preparado

`ticket-service.spec.ts` ya contiene, como comentario explícito dejado en una fase anterior:

> "Los helpers son privados; se accede por índice ('money') porque la Fase 5 los extraerá a funciones exportadas y estos tests serán su red de seguridad. NO tocar el servicio."

Es decir: ya existe cobertura de test para cada helper puro y cada `html*()` builder, accedida hoy vía `(service as any)['nombre']`. Esa cobertura se reescribe para llamar a las funciones exportadas directamente (sin bracket-access), sirviendo de red de seguridad de la extracción.

## Consumidores (10 archivos, verificados por grep)

Todos importan `TicketService` (y a veces `VentaContexto`, `TicketPagoDetalle`, `TicketMembresia`, `TicketItem`, `VentaBackend`) desde `shared/ticket/ticket-service`, inyectan con `inject(TicketService)`, y llaman solo 7 métodos públicos: `imprimirAccesoria`, `imprimirCorteDesdeBackend`, `imprimirSalidaEfectivo`, `imprimirMembresiaDesdeContexto`, `imprimirVentaDesdeBackend`, `imprimirVentaDesdeCarrito`, `imprimirMembresia`.

**Decisión de diseño clave**: la clase `TicketService` se queda en `ticket-service.ts`, con el mismo nombre, misma ruta de import, mismos nombres/firmas de método. Cero cambios en los 10 consumidores — el split es puramente interno.

## Arquitectura destino

1. **`shared/ticket/ticket-html.ts`** (nuevo, funciones puras, sin `@Injectable`, mismo patrón que `calculo-membresia.ts`):
   - Todos los tipos/interfaces (`TicketTipo`, `TicketPagoDetalle`, `TicketHeader`, `TicketItem`, `TicketTotales`, `TicketVenta`, `TicketMembresia`, `TicketEntrenador`, `TicketAccesoria`, `TicketSalidaEfectivo`, `VentaContexto`, `CarritoItemCrudo`, `VentaBackend`, `TicketCorte`, `CorteBackend`).
   - Helpers puros (antes privados): `money`, `escape`, `toNum`, `toInt`, `up`, `pickNum`, `docId`, `fechaConSegundos`, `mesAnio`, `calcularSubtotal`, `normalizarItemsDesdeBackend`, `normalizarPagosVentaDesdeBackend`, `sumarPorOrigen`, `metodoFromDesglose`, `sumarPagosPorMetodo`, `normalizeMetodoPago`, `pagosObjToList`, `normalizarDesglose`, `pagoLabel`, `pagoLabelCorto`, `sumarEfectivo`, `resolverTiposIngreso`, `fechaIni`, `fechaFin`, `nombreUsuario`, `renderBloquePagos`, `baseStyles`, `rollMm`, `shiftMm`.
   - Generadores HTML (antes privados): `htmlVenta`, `htmlMembresia`, `htmlEntrenador`, `htmlAccesoria`, `htmlSalidaEfectivo`, `htmlCorte`. Cada uno recibe sus datos + llama a los helpers de arriba directamente (ya no `this.xxx`, sino llamada de función a función dentro del mismo módulo).
   - Nada de `window`/`document`/Electron aquí. `baseStyles` sí lee `localStorage` (config de impresora: `ra_roll_mm`/`ra_shift_mm`) — es lectura simple sin efectos secundarios, se mantiene igual que en `ticket-contexto.ts`.

2. **`shared/ticket/ticket-print.ts`** (nuevo, `@Injectable({providedIn:'root'})` — servicio delgado de impresión):
   - `abrirYImprimir(html, nombreArchivo)`: detecta `window.electron.printTicket`, si no existe usa `window.open` + `print()`, si el popup es bloqueado descarga el HTML.
   - `verComoHtml(html, nombre)`: preview en pestaña nueva (o descarga si el popup es bloqueado).
   - `descargarHtml(nombre, html)`: fallback vía Blob + `<a download>`.
   - Toda la plomería de Electron/DOM que hoy vive en la Sección D del archivo actual.

3. **`shared/ticket/ticket-service.ts`** (se queda, se adelgaza):
   - Sigue siendo `@Injectable({providedIn:'root'}) export class TicketService`.
   - Inyecta `private print = inject(TicketPrintService)`.
   - Conserva únicamente los métodos de orquestación (Secciones A y B del archivo actual): adapta datos de dominio (`VentaBackend`, `CarritoItemCrudo`, `CorteBackend`, contexto de membresía) a los tipos `Ticket*`, invoca los `html*()` puros de `ticket-html.ts`, y delega la salida a `TicketPrintService`.
   - Re-exporta todos los tipos de `ticket-html.ts` (`export * from './ticket-html'`) para que ningún import de tipos en los 10 consumidores se rompa.
   - Meta: bajar de 1609 a bien por debajo de 400 líneas.

4. **Tests**: `ticket-html.spec.ts` (nuevo, helpers + html builders probados como funciones exportadas reales), `ticket-print.spec.ts` (nuevo, cubre las 3 ramas de cada método: Electron / `window.open` / popup bloqueado → descarga), `ticket-service.spec.ts` (se reduce a smoke test de creación + verificación de que cada método de orquestación arma los datos correctos y delega correctamente, mockeando `TicketPrintService`).

## Fuera de alcance

- No se cambia ningún nombre de método público de `TicketService`, ninguna firma, ningún import path en los 10 consumidores.
- No se toca `electron/main.js` ni `electron/preload.js` (fuera de alcance según el spec maestro).
- No se cambia ningún cálculo de negocio (subtotales, formato de moneda, normalización de métodos de pago) — es un split estructural, no una corrección de lógica.
