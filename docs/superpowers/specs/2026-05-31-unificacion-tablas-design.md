# Diseño: Unificación de tablas al estilo de Membresías

**Fecha:** 2026-05-31  
**Estado:** Aprobado  

---

## Resumen

Unificar el diseño de las 24 tablas del proyecto para que todas tengan la misma estructura, clases visuales y comportamiento que la tabla de `membresia.html`. El botón "Agregar" y links de navegación se mantienen fuera del card. La paginación se integra dentro del footer del card.

---

## Alcance

### Páginas principales (con paginación + toolbar completo)

| Archivo | Notas |
|---|---|
| `socio/socio.html` | |
| `inventario/inventario.html` | |
| `entrenador/entrenador.html` | |
| `administracion/promociones/promociones.html` | |
| `administracion/corte-caja-admin/corte-caja-admin.html` | |
| `administracion/usuarios-admin/usuarios-admin.html` | |
| `administracion/ventas-admin/ventas-admin.html` | |
| `producto/producto.html` | |
| `paquete/paquete.html` | |
| `categoria/categoria.html` | |
| `asesoria-nutricional/asesoria-nutricional.html` | |
| `administracion/estadisticas/estadisticas.html` | |
| `punto-venta/punto-venta.html` | |
| `corte-caja/corte-caja.html` | |
| `inscripcion/historial/historial.html` | Sub-vista con su propia paginación |

### Sub-vistas y modales (card + toolbar + tabla, sin footer de paginación)

| Archivo |
|---|
| `administracion/ventas-admin/ventas-admin-modal/ventas-admin-modal.html` |
| `administracion/corte-caja-admin/corte-caja-info/corte-caja-info.html` |
| `corte-caja/corte-caja-modal/corte-caja-modal.html` |
| `inscripcion/asistencia-historial/asistencia-historial.html` |
| `entrenador/entrenador-modal/entrenador-modal.html` |
| `entrenador/entrenador-info-asesoria/entrenador-info-asesoria.html` |
| `socio/socio-info-asesoria/socio-info-asesoria.html` |
| `socio/socio-informacion/socio-informacion.html` |

---

## Referencia canónica

El diseño de referencia es `membresia/membresia.html`. Todos los cambios deben producir un resultado visualmente idéntico a esa página.

---

## Estructura del card

```
[Barra exterior — solo si hay botón Agregar / nav links]  ← no se toca

<div class="mx-1 bg-white rounded-xl ring-1 ring-black/10 shadow-card overflow-hidden">

  <!-- TOOLBAR -->
  <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
    <h1 class="text-base sm:text-lg font-semibold text-ra-slate shrink-0">Título</h1>
    <div class="w-px h-5 bg-gray-200 shrink-0"></div>
    <!-- filtros, búsqueda — cada elemento con shrink-0 -->
  </div>

  <!-- TABLA -->
  <div class="overflow-x-auto">
    <div>
      <table class="w-full min-w-[Xpx] border-collapse table-fixed text-xs">
        <colgroup>...</colgroup>
        <thead class="sticky top-0 bg-ra-grayLight/40 backdrop-blur z-10">
          <tr>
            <th class="py-3 px-3 text-center text-ra-slate font-semibold uppercase text-[11px]">...</th>
            <!-- text-left para columnas de texto largo -->
          </tr>
        </thead>
        <tbody>
          <!-- estado cargando -->
          <tr><td [attr.colspan]="99" class="py-10 text-center text-ra-slate">Cargando…</td></tr>
          <!-- estado error -->
          <tr><td [attr.colspan]="99" class="py-10 text-center text-red-600">{{ error }}</td></tr>
          <!-- estado vacío -->
          <tr><td [attr.colspan]="99" class="py-10 text-center text-ra-slate">Sin resultados.</td></tr>
          <!-- fila normal -->
          <tr class="border-t border-gray-100 hover:bg-gray-50/60">
            <td class="py-2.5 px-3 text-center text-[11px]">...</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- FOOTER — solo en páginas con paginación -->
  <div class="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
    <!-- Izquierda -->
    <div class="flex items-center gap-2 text-ra-slate/70 shrink-0">
      <span>Página <strong class="text-ra-slate">{{ pageUI }}</strong> de <strong class="text-ra-slate">{{ totalPages }}</strong></span>
      <span class="text-ra-slate/50">({{ totalElements }} registros)</span>
      <!-- chip de filtro activo si aplica -->
    </div>
    <!-- Derecha -->
    <div class="flex items-center gap-2 overflow-x-auto">
      <!-- Ordenar por (solo si la página tiene sort) -->
      <span class="text-ra-slate/60 whitespace-nowrap shrink-0">Ordenar por</span>
      <select class="h-8 w-[110px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs shadow-inner shrink-0" ...>
      <select class="h-8 w-[80px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs shadow-inner shrink-0" ...>
      <div class="w-px h-4 bg-gray-200 shrink-0"></div>
      <!-- Por página -->
      <span class="text-ra-slate/60 whitespace-nowrap shrink-0">Por página</span>
      <select class="h-8 w-[70px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs shadow-inner shrink-0" ...>
      <div class="w-px h-4 bg-gray-200 shrink-0"></div>
      <button class="h-8 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-xs shrink-0" [disabled]="!puedePrev" (click)="prev()">Anterior</button>
      <button class="h-8 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 text-xs shrink-0" [disabled]="!puedeNext" (click)="next()">Siguiente</button>
    </div>
  </div>

</div>
```

---

## Reglas de clases

### Card container
- **Antes:** `rounded-xl2 mx-4 md:mx-10` / `ml-2 md:ml-4 mr-2 sm:mr-4 md:mr-8` + variantes
- **Después:** `mx-1 bg-white rounded-xl ring-1 ring-black/10 shadow-card overflow-hidden`

### Scroll de tabla
- **Antes:** `overflow-x-hidden` + `overflow-y-auto max-h-[calc(100dvh-Xpx)]`
- **Después:** `overflow-x-auto` simple (sin max-height — la página entera hace scroll)

### Table
- **Antes:** `table-auto xl:table-fixed text-[11px] sm:text-[12px] lg:text-[10.5px]...` + variantes
- **Después:** `w-full min-w-[Xpx] border-collapse table-fixed text-xs`

### Header (`<th>`)
- **Antes:** `py-2 px-3 xl:px-2 font-semibold uppercase` con múltiples breakpoints
- **Después:** `py-3 px-3 text-ra-slate font-semibold uppercase text-[11px]`

### Filas (`<tr>`)
- **Antes:** `border-t border-ra-grayLight/60 hover:bg-ra-bg`
- **Después:** `border-t border-gray-100 hover:bg-gray-50/60`

### Celdas (`<td>`)
- **Antes:** `py-2 lg:py-1.5 2xl:py-2.5 px-3 sm:px-4 lg:px-3.5 2xl:px-6` con múltiples breakpoints
- **Después:** `py-2.5 px-3 text-[11px]` (+ `text-center` / `text-left` según columna)

### Input de búsqueda en toolbar
```html
<input class="w-[240px] h-8 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs shadow-inner" />
```
Botón limpiar: `h-8 px-3 rounded-lg border border-gray-200 text-xs text-ra-slate hover:bg-gray-50 shrink-0`

### Dropdown de acciones (⋮)
Se mantiene igual en todas las páginas — no se modifica.

---

## min-w de tabla por página (estimado)

Cada página debe definir un `min-w-[Xpx]` según la cantidad de columnas visibles:

| Página | min-w estimado |
|---|---|
| membresia (referencia) | 860px |
| socio | 700px |
| producto | 860px |
| paquete | 700px |
| categoria | 500px |
| inventario | 800px |
| entrenador | 700px |
| promociones | 700px |
| corte-caja-admin | 860px |
| usuarios-admin | 700px |
| ventas-admin | 860px |
| asesoria-nutricional | 700px |
| punto-venta | 700px |
| corte-caja | 800px |
| Sub-vistas/modales | 500–700px según columnas |

> Los min-w exactos se ajustarán durante la implementación mirando las columnas de cada página.

---

## Nota sobre sub-vistas dentro de modales

Las sub-vistas que ya viven dentro de un modal (`entrenador-modal`, `corte-caja-modal`, etc.) no deben agregar `mx-1` al card si ya están envueltas en un contenedor con padding propio. En esos casos, el card usa `bg-white rounded-xl ring-1 ring-black/10 shadow-card overflow-hidden` sin el `mx-1`. El implementador debe inspeccionar el contexto de cada sub-vista para decidir.

---

## Lo que NO cambia

- El botón "Agregar" y links de navegación en barras superiores externas
- Los componentes `<ra-gimnasio-filter>` y otros filtros especiales
- El dropdown de acciones (⋮) y su contenido
- Los badges, chips y estilos de datos (colores por estado, etc.)
- La lógica TypeScript (paginación, ordenamiento, búsqueda)
- Los modales de crear/editar

---

## Orden de implementación sugerido

1. Páginas simples sin paginación compleja: `categoria`, `paquete`
2. Páginas con paginación estándar: `socio`, `producto`, `inventario`, `entrenador`, `promociones`, `usuarios-admin`
3. Páginas con lógica especial: `ventas-admin`, `asesoria-nutricional`, `corte-caja`, `corte-caja-admin`, `punto-venta`, `estadisticas`, `historial`
4. Sub-vistas y modales (solo card + toolbar + tabla)
