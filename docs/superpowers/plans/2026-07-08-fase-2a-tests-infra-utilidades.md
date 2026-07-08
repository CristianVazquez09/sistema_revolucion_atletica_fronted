# Fase 2a — Infraestructura de tests + utilidades puras + servicios ejemplares: Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar `ng test` funcionando (hoy ni compila), y sentar la red de seguridad inicial: tests de las utilidades puras y de 3 servicios ejemplares que fijan el patrón para el resto de la Fase 2.

**Architecture:** Primera de tres oleadas de la Fase 2 del spec `docs/superpowers/specs/2026-07-07-reorganizacion-arquitectura-design.md`. 2a = infra + utilidades + 3 ejemplares (GenericService puro, servicio HTTP con lógica de params, store con signals). 2b = resto de servicios HTTP. 2c = reducers/selectors NgRx + helpers de ticket-service. Los tests **documentan el comportamiento actual (AS-IS)**: si un test revela un bug sospechoso, NO se corrige el código de producción — se asevera el comportamiento actual y se anota el hallazgo.

**Tech Stack:** Angular 20, Karma + Jasmine (builder `@angular/build:karma`), `HttpTestingController` de `@angular/common/http/testing`. App en producción.

**Reglas transversales:**
- Código de producción INTOCABLE en esta fase, con exactamente 3 excepciones de infra: `tsconfig.spec.json`, `src/app/app.spec.ts`, `package.json` (solo `scripts`).
- Commits: mensaje en español, estilo `test(): ...` o `chore(): ...`, una línea, SIN trailer de coautoría.
- Nunca commitear `.claude/settings.local.json`.
- Comando de tests durante desarrollo: `npx ng test --watch=false --browsers=ChromeHeadless` (~30-60 s).
- Hallazgos AS-IS conocidos de antemano (asevéralos tal cual, no los "arregles"):
  - `calcularFechaFin` no tiene caso para `VISITA_10`/`VISITA_15` → caen al fallback +1 mes, aunque su etiqueta comercial dice "2 meses". Posible bug real; decisión del dueño en Fase 5.
  - `calcularFechaFin` usa `toISOString()` (UTC): las aserciones de fecha asumen huso horario de México (UTC-6), donde la conversión no desplaza el día. No portable a husos UTC+.

---

### Task 1: Rama de trabajo y línea base

**Files:** ninguno (git + comandos)

- [ ] **Step 1: Crear rama desde main**

```bash
git checkout main && git checkout -b test/fase-2a-infra-utilidades
```

- [ ] **Step 2: Línea base de build**

Run: `npm run build:web`
Expected: `Application bundle generation complete` + 2 warnings de presupuesto conocidas (bundle inicial ~12.4 kB sobre 600 kB; estadisticas.scss ~844 bytes). Si hay ERRORES, DETENTE y repórtalo.

- [ ] **Step 3: Línea base de tests (debe fallar la compilación — es el punto de partida)**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -15`
Expected: errores `TS2571: Object is of type 'unknown'` en `ra-gimnasio-filter.ts`. Esto confirma el bug pre-existente que la Task 2 corrige. No commitees nada.

---

### Task 2: Arreglar `tsconfig.spec.json` (baseUrl faltante)

Causa raíz: `ra-gimnasio-filter.ts` (y otros) importan con rutas absolutas estilo `from 'src/app/...'`. Eso requiere `baseUrl` y `tsconfig.spec.json` no lo tiene (el de app sí).

**Files:**
- Modify: `tsconfig.spec.json`

- [ ] **Step 1: Agregar baseUrl**

`tsconfig.spec.json` queda EXACTAMENTE así (solo se agrega la línea `"baseUrl": "./",`):

```json
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "baseUrl": "./",
    "types": [
      "jasmine"
    ]
  },
  "include": [
    "src/**/*.ts"
  ]
}
```

- [ ] **Step 2: Verificar que la compilación de specs ya resuelve**

Run: `npx tsc -p tsconfig.spec.json --noEmit`
Expected: exit 0, sin errores TS2571.

- [ ] **Step 3: Correr tests — ahora compila pero falla UN test obsoleto**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -10`
Expected: la suite CORRE (Chrome Headless arranca) y falla exactamente 1 test: `App should render title` (busca un `h1` con "Hello, revolucion-atletica-frontend", texto del starter de Angular que ya no existe). El test `should create the app` puede fallar también por falta de providers de Router — se arregla en Task 3. Registra el resultado exacto.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.spec.json
git commit -m "test(): agregar baseUrl a tsconfig.spec.json para resolver imports absolutos src/"
```

---

### Task 3: Reescribir `app.spec.ts` y agregar scripts npm

**Files:**
- Modify: `src/app/app.spec.ts` (reemplazo completo)
- Modify: `package.json` (solo bloque `scripts`)

- [ ] **Step 1: Reemplazar app.spec.ts completo**

`src/app/app.spec.ts` queda EXACTAMENTE así (App renderiza `<router-outlet>` + `<app-notificacion-host>`; RouterOutlet necesita `provideRouter`):

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('debe crear la app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('debe renderizar el router-outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr tests**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: `Executed 2 of 2 SUCCESS`.

- [ ] **Step 3: Agregar scripts npm**

En `package.json`, dentro de `"scripts"`, agregar estas 2 entradas (sin tocar las existentes):

```json
    "test:ci": "ng test --watch=false --browsers=ChromeHeadless",
    "verificar": "npm run test:ci && npm run build:web",
```

- [ ] **Step 4: Verificar el script completo**

Run: `npm run verificar`
Expected: tests 2/2 SUCCESS y build completo con las 2 warnings de presupuesto conocidas.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.spec.ts package.json
git commit -m "test(): reescribir app.spec obsoleto y agregar scripts test:ci y verificar"
```

---

### Task 4: Tests de `fechas-precios.ts`

**Files:**
- Test (create): `src/app/util/fechas-precios.spec.ts`

Fuente bajo prueba: `hoyISO()` (impura, `new Date()` — controlar con `jasmine.clock().mockDate`), `calcularFechaFin(inicioISO, tiempo?)`, `calcularTotal(precio, descuento=0, costoInscripcion=0)`, `dateLocalFromISO(iso)`.

- [ ] **Step 1: Escribir el spec completo**

```typescript
import { hoyISO, calcularFechaFin, calcularTotal, dateLocalFromISO } from './fechas-precios';

// NOTA: las aserciones de calcularFechaFin dependen de que el huso local no vaya
// adelante de UTC (México, UTC-6): la función usa toISOString() sobre fechas locales.
describe('fechas-precios', () => {
  describe('hoyISO', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 6, 8)); // 8 de julio de 2026, local
    });
    afterEach(() => jasmine.clock().uninstall());

    it('devuelve la fecha local de hoy como YYYY-MM-DD', () => {
      expect(hoyISO()).toBe('2026-07-08');
    });
  });

  describe('calcularFechaFin', () => {
    it('VISITA suma 1 día', () => {
      expect(calcularFechaFin('2026-03-10', 'VISITA')).toBe('2026-03-11');
    });

    it('alias legacy VISTA también suma 1 día', () => {
      expect(calcularFechaFin('2026-03-10', 'VISTA')).toBe('2026-03-11');
    });

    it('DIEZ_DIAS suma 10 días', () => {
      expect(calcularFechaFin('2026-03-10', 'DIEZ_DIAS')).toBe('2026-03-20');
    });

    it('QUINCE_DIAS suma 15 días', () => {
      expect(calcularFechaFin('2026-03-10', 'QUINCE_DIAS')).toBe('2026-03-25');
    });

    it('UNA_SEMANA suma 7 días', () => {
      expect(calcularFechaFin('2026-03-10', 'UNA_SEMANA')).toBe('2026-03-17');
    });

    it('DOS_SEMANAS suma 14 días', () => {
      expect(calcularFechaFin('2026-03-10', 'DOS_SEMANAS')).toBe('2026-03-24');
    });

    it('UN_MES suma 1 mes', () => {
      expect(calcularFechaFin('2026-03-10', 'UN_MES')).toBe('2026-04-10');
    });

    it('TRES_MESES suma 3 meses', () => {
      expect(calcularFechaFin('2026-03-10', 'TRES_MESES')).toBe('2026-06-10');
    });

    it('SEIS_MESES suma 6 meses', () => {
      expect(calcularFechaFin('2026-03-10', 'SEIS_MESES')).toBe('2026-09-10');
    });

    it('UN_ANIO suma 1 año', () => {
      expect(calcularFechaFin('2026-03-10', 'UN_ANIO')).toBe('2027-03-10');
    });

    it('mes con desbordamiento: 31 de enero + UN_MES desborda a marzo (comportamiento AS-IS de setMonth)', () => {
      expect(calcularFechaFin('2026-01-31', 'UN_MES')).toBe('2026-03-03');
    });

    it('tiempo desconocido cae al fallback de +1 mes', () => {
      expect(calcularFechaFin('2026-03-10', 'ALGO_RARO')).toBe('2026-04-10');
    });

    // HALLAZGO AS-IS: VISITA_10/VISITA_15 no tienen caso propio y caen al fallback
    // de +1 mes, aunque su etiqueta comercial dice "2 meses". Documentado para Fase 5.
    it('VISITA_10 cae al fallback de +1 mes (posible bug documentado)', () => {
      expect(calcularFechaFin('2026-03-10', 'VISITA_10')).toBe('2026-04-10');
    });

    it('VISITA_15 cae al fallback de +1 mes (posible bug documentado)', () => {
      expect(calcularFechaFin('2026-03-10', 'VISITA_15')).toBe('2026-04-10');
    });

    it('sin fecha de inicio devuelve hoy', () => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 6, 8));
      expect(calcularFechaFin('', 'UN_MES')).toBe('2026-07-08');
      jasmine.clock().uninstall();
    });
  });

  describe('calcularTotal', () => {
    it('sin descuento ni inscripción devuelve el precio', () => {
      expect(calcularTotal(500)).toBe(500);
    });

    it('resta el descuento', () => {
      expect(calcularTotal(500, 100)).toBe(400);
    });

    it('suma el costo de inscripción', () => {
      expect(calcularTotal(500, 0, 150)).toBe(650);
    });

    it('combina precio + inscripción - descuento', () => {
      expect(calcularTotal(500, 100, 150)).toBe(550);
    });

    it('nunca devuelve negativo', () => {
      expect(calcularTotal(100, 500)).toBe(0);
    });

    it('redondea a 2 decimales', () => {
      expect(calcularTotal(99.999)).toBe(100);
      expect(calcularTotal(10.126, 0.01)).toBe(10.12);
    });

    it('trata null/undefined/0 como 0', () => {
      expect(calcularTotal(0)).toBe(0);
      expect(calcularTotal(100, undefined, undefined)).toBe(100);
    });
  });

  describe('dateLocalFromISO', () => {
    it('parsea YYYY-MM-DD a medianoche local', () => {
      const d = dateLocalFromISO('2026-05-01');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(4);
      expect(d.getDate()).toBe(1);
      expect(d.getHours()).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Correr y verificar**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: `Executed 27 of 27 SUCCESS` (2 de app + 25 nuevos). Si alguna aserción de `calcularFechaFin` falla, NO cambies la función: ajusta la aserción al valor real observado y anótalo en tu reporte (los tests documentan AS-IS).

- [ ] **Step 3: Commit**

```bash
git add src/app/util/fechas-precios.spec.ts
git commit -m "test(): cubrir fechas-precios (calculo de vigencias y totales, hallazgo VISITA_10/15 documentado)"
```

---

### Task 5: Tests del pipe `tiempo-plan-label.ts`

**Files:**
- Test (create): `src/app/util/tiempo-plan-label.spec.ts`

- [ ] **Step 1: Escribir el spec completo**

```typescript
import { TiempoPlanLabelPipe } from './tiempo-plan-label';
import { TiempoPlan } from './enums/tiempo-plan';

describe('TiempoPlanLabelPipe', () => {
  let pipe: TiempoPlanLabelPipe;

  beforeEach(() => {
    pipe = new TiempoPlanLabelPipe();
  });

  it('mapea las claves base del enum', () => {
    expect(pipe.transform(TiempoPlan.VISITA)).toBe('Visita');
    expect(pipe.transform(TiempoPlan.DIEZ_DIAS)).toBe('10 días');
    expect(pipe.transform(TiempoPlan.QUINCE_DIAS)).toBe('15 días');
    expect(pipe.transform(TiempoPlan.UNA_SEMANA)).toBe('1 semana');
    expect(pipe.transform(TiempoPlan.DOS_SEMANAS)).toBe('2 semanas');
    expect(pipe.transform(TiempoPlan.MENSUAL)).toBe('1 mes');       // enum MENSUAL = 'UN_MES'
    expect(pipe.transform(TiempoPlan.TRIMESTRAL)).toBe('3 meses');  // enum TRIMESTRAL = 'TRES_MESES'
    expect(pipe.transform(TiempoPlan.SEMESTRAL)).toBe('6 meses');
    expect(pipe.transform(TiempoPlan.ANUAL)).toBe('1 año');
  });

  it('mapea los planes por visitas', () => {
    expect(pipe.transform(TiempoPlan.VISITA_10)).toBe('10 visitas (2 meses)');
    expect(pipe.transform(TiempoPlan.VISITA_15)).toBe('15 visitas (2 meses)');
  });

  it('mapea alias legacy y strings "bonitos"', () => {
    expect(pipe.transform('VISTA')).toBe('Visita');
    expect(pipe.transform('MENSUAL')).toBe('Mensual');
    expect(pipe.transform('TRIMESTRAL')).toBe('Trimestral');
    expect(pipe.transform('SEMESTRAL')).toBe('Semestral');
    expect(pipe.transform('ANUAL')).toBe('Anual');
  });

  it('es insensible a mayúsculas', () => {
    expect(pipe.transform('un_mes')).toBe('1 mes');
  });

  it('claves desconocidas caen al fallback Title Case', () => {
    expect(pipe.transform('PLAN_ESPECIAL')).toBe('Plan Especial');
  });

  it('null y undefined devuelven cadena vacía', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Correr y verificar**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: `Executed 33 of 33 SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add src/app/util/tiempo-plan-label.spec.ts
git commit -m "test(): cubrir pipe tiempoPlan (mapa de etiquetas y fallback)"
```

---

### Task 6: Tests de `ticket-contexto.ts`

**Files:**
- Test (create): `src/app/util/ticket-contexto.spec.ts`

Fuente: `obtenerNombreCajero(fallback?)` lee `sessionStorage` (claves `nombre`, `apellido`, `username`); `crearContextoTicket(gym, cajero)` es pura.

- [ ] **Step 1: Escribir el spec completo**

```typescript
import { obtenerNombreCajero, crearContextoTicket } from './ticket-contexto';
import { GimnasioData } from '../model/gimnasio-data';

describe('ticket-contexto', () => {
  describe('obtenerNombreCajero', () => {
    beforeEach(() => sessionStorage.clear());
    afterEach(() => sessionStorage.clear());

    it('prioriza "nombre apellido" del sessionStorage', () => {
      sessionStorage.setItem('nombre', 'Ana');
      sessionStorage.setItem('apellido', 'García');
      sessionStorage.setItem('username', 'anag');
      expect(obtenerNombreCajero()).toBe('Ana García');
    });

    it('usa solo el nombre si no hay apellido', () => {
      sessionStorage.setItem('nombre', 'Ana');
      expect(obtenerNombreCajero()).toBe('Ana');
    });

    it('cae al username si no hay nombre ni apellido', () => {
      sessionStorage.setItem('username', 'anag');
      expect(obtenerNombreCajero()).toBe('anag');
    });

    it('cae al fallback si sessionStorage está vacío', () => {
      expect(obtenerNombreCajero('Recepción')).toBe('Recepción');
    });

    it('sin nada devuelve "Cajero"', () => {
      expect(obtenerNombreCajero()).toBe('Cajero');
    });

    it('ignora espacios en blanco', () => {
      sessionStorage.setItem('nombre', '   ');
      sessionStorage.setItem('username', '  anag  ');
      expect(obtenerNombreCajero()).toBe('anag');
    });
  });

  describe('crearContextoTicket', () => {
    it('con gimnasio arma el contexto completo', () => {
      const gym = {
        idGimnasio: 1,
        nombre: 'RA Centro',
        direccion: 'Av. Principal 123',
        telefono: '5512345678',
      } as GimnasioData;

      const ctx = crearContextoTicket(gym, 'Ana García');

      expect(ctx.negocio.nombre).toBe('RA Centro');
      expect(ctx.negocio.direccion).toBe('Av. Principal 123');
      expect(ctx.negocio.telefono).toBe('5512345678');
      expect(ctx.cajero).toBe('Ana García');
      expect(ctx.leyendaLateral).toBe('RA Centro');
      expect(ctx.brandTitle).toBe('REVOLUCIÓN ATLÉTICA');
    });

    it('con gimnasio null usa los defaults', () => {
      const ctx = crearContextoTicket(null, 'Cajero');
      expect(ctx.negocio.nombre).toBe('Tu gimnasio');
      expect(ctx.negocio.direccion).toBe('');
      expect(ctx.negocio.telefono).toBe('');
      expect(ctx.leyendaLateral).toBe('Tu gimnasio');
    });
  });
});
```

- [ ] **Step 2: Correr y verificar**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: `Executed 41 of 41 SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add src/app/util/ticket-contexto.spec.ts
git commit -m "test(): cubrir ticket-contexto (nombre de cajero y contexto de ticket)"
```

---

### Task 7: Tests de `CarritoService` (ejemplar de store con signals)

**Files:**
- Test (create): `src/app/services/carrito-service.spec.ts`

Fuente: signals privados + `totalSig` computed; `agregar` acumula cantidad si el producto ya existe y auto-selecciona; `restarSeleccionado` no baja de 1; `eliminarSeleccionado` limpia la selección; `seleccionarIndice` ignora índices fuera de rango.

- [ ] **Step 1: Escribir el spec completo**

```typescript
import { TestBed } from '@angular/core/testing';
import { CarritoService } from './carrito-service';

describe('CarritoService', () => {
  let carrito: CarritoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    carrito = TestBed.inject(CarritoService);
    carrito.limpiar();
  });

  it('inicia vacío, sin selección y con total 0', () => {
    expect(carrito.obtenerItems()).toEqual([]);
    expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
    expect(carrito.obtenerTotal()).toBe(0);
  });

  describe('agregar', () => {
    it('agrega un producto nuevo y lo selecciona', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      expect(carrito.obtenerItems()).toEqual([
        { idProducto: 1, nombre: 'Agua', cantidad: 2, precioUnit: 20 },
      ]);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
    });

    it('acumula cantidad si el producto ya está y lo re-selecciona', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      carrito.agregar(2, 'Proteína', 500, 1);
      carrito.agregar(1, 'Agua', 20, 3);
      expect(carrito.obtenerItems()[0].cantidad).toBe(5);
      expect(carrito.obtenerItems().length).toBe(2);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
    });

    it('ignora cantidades <= 0', () => {
      carrito.agregar(1, 'Agua', 20, 0);
      carrito.agregar(1, 'Agua', 20, -5);
      expect(carrito.obtenerItems()).toEqual([]);
    });
  });

  describe('totalSig', () => {
    it('calcula la suma de cantidad * precioUnit', () => {
      carrito.agregar(1, 'Agua', 20, 2);      // 40
      carrito.agregar(2, 'Proteína', 500, 1); // 500
      expect(carrito.obtenerTotal()).toBe(540);
    });
  });

  describe('cantidadEnCarrito', () => {
    it('devuelve la cantidad del producto o 0', () => {
      carrito.agregar(1, 'Agua', 20, 3);
      expect(carrito.cantidadEnCarrito(1)).toBe(3);
      expect(carrito.cantidadEnCarrito(99)).toBe(0);
    });
  });

  describe('seleccionarIndice', () => {
    it('acepta índices válidos y null', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.agregar(2, 'Proteína', 500, 1);
      carrito.seleccionarIndice(0);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
      carrito.seleccionarIndice(null);
      expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
    });

    it('ignora índices fuera de rango', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.seleccionarIndice(5);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0); // sigue el auto-seleccionado por agregar
      carrito.seleccionarIndice(-1);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
    });
  });

  describe('sumarSeleccionado / restarSeleccionado', () => {
    it('suma 1 al seleccionado', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.sumarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(2);
    });

    it('resta 1 pero nunca baja de 1', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      carrito.restarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(1);
      carrito.restarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(1);
    });

    it('sin selección no hacen nada', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      carrito.seleccionarIndice(null);
      carrito.sumarSeleccionado();
      carrito.restarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(2);
    });
  });

  describe('eliminarSeleccionado', () => {
    it('elimina el item y limpia la selección', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.agregar(2, 'Proteína', 500, 1);
      carrito.seleccionarIndice(0);
      carrito.eliminarSeleccionado();
      expect(carrito.obtenerItems().length).toBe(1);
      expect(carrito.obtenerItems()[0].idProducto).toBe(2);
      expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
    });
  });

  describe('limpiar', () => {
    it('vacía items y selección', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.limpiar();
      expect(carrito.obtenerItems()).toEqual([]);
      expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
      expect(carrito.obtenerTotal()).toBe(0);
    });
  });
});
```

NOTA: `CarritoService` es `providedIn: 'root'` — el `carrito.limpiar()` del beforeEach garantiza aislamiento entre tests aunque TestBed reutilice la instancia.

- [ ] **Step 2: Correr y verificar**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: `Executed 54 of 54 SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add src/app/services/carrito-service.spec.ts
git commit -m "test(): cubrir CarritoService (agregar, totales, seleccion y limites)"
```

---

### Task 8: Tests de `CategoriaService` (ejemplar del patrón GenericService)

**Files:**
- Test (create): `src/app/services/categoria-service.spec.ts`

`CategoriaService extends GenericService<CategoriaData>` sin métodos propios: al testearlo se fija el patrón de los 5 métodos heredados (`buscarTodos` GET base, `buscarPorId` GET base/{id}, `guardar` POST, `actualizar` PUT base/{id}, `eliminar` DELETE base/{id}) contra `${environment.HOST}/categorias`. Este spec es EL EJEMPLAR que copiarán los ~20 servicios de la Fase 2b.

- [ ] **Step 1: Escribir el spec completo**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CategoriaService } from './categoria-service';
import { CategoriaData } from '../model/categoria-data';
import { environment } from '../../environments/environment';

describe('CategoriaService', () => {
  const BASE = `${environment.HOST}/categorias`;
  let service: CategoriaService;
  let httpMock: HttpTestingController;

  const categoria = { idCategoria: 1, nombre: 'Suplementos' } as unknown as CategoriaData;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoriaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscarTodos hace GET a la URL base', () => {
    let resultado: CategoriaData[] | undefined;
    service.buscarTodos().subscribe(r => (resultado = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([categoria]);

    expect(resultado).toEqual([categoria]);
  });

  it('buscarPorId hace GET a base/{id}', () => {
    service.buscarPorId(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('GET');
    req.flush(categoria);
  });

  it('guardar hace POST a la base con la entidad como body', () => {
    service.guardar(categoria).subscribe();
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(categoria);
    req.flush(categoria);
  });

  it('actualizar hace PUT a base/{id} con la entidad como body', () => {
    service.actualizar(7, categoria).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(categoria);
    req.flush(categoria);
  });

  it('eliminar hace DELETE a base/{id}', () => {
    service.eliminar(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
```

NOTA para el implementador: antes de correr, verifica con `grep -n "eliminar" src/app/services/generic-service.ts` que el método `eliminar` existe en GenericService (el catálogo lo lista, pero el archivo solo se leyó parcialmente en la planeación). Si no existe, elimina ese test y anótalo en el reporte.

- [ ] **Step 2: Correr y verificar**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: `Executed 59 of 59 SUCCESS` (ajusta el total si el test de eliminar no aplica).

- [ ] **Step 3: Commit**

```bash
git add src/app/services/categoria-service.spec.ts
git commit -m "test(): cubrir CategoriaService como ejemplar del patron GenericService"
```

---

### Task 9: Tests de `CheckInService` (ejemplar de servicio con lógica de parámetros)

**Files:**
- Test (create): `src/app/services/check-in-service.spec.ts`

Base: `${environment.HOST}/asistencias`. Métodos (verificar nombres de params contra el archivo fuente ANTES de escribir — los tests documentan AS-IS; si un nombre difiere del plan, gana el fuente):
- `registrarEntradaPorMembresia(idMembresia)` POST `/asistencias/checkin` body `{idMembresia}`
- `registrarEntradaPorSocio(idSocio)` POST `/asistencias/checkin` body `{idSocio}`
- `registrarEntradaPorHuella(huellaDigital)` POST `/asistencias/checkin/huella` body `{huellaDigital}`
- `listarHistorial(pagina, tamanio, termino?, origen?)` GET `/asistencias?page&size[&q][&origen]`
- `buscar(pagina, tamanio, desde?, hasta?, nombre?)` GET `/asistencias/buscar?page&size[&desde&hasta][&nombre]` — las fechas solo van si están AMBAS

- [ ] **Step 1: Escribir el spec completo**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CheckInService } from './check-in-service';
import { environment } from '../../environments/environment';

describe('CheckInService', () => {
  const BASE = `${environment.HOST}/asistencias`;
  let service: CheckInService;
  let httpMock: HttpTestingController;

  const paginaVacia = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 5 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CheckInService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('registrarEntradaPorMembresia hace POST /checkin con {idMembresia}', () => {
    service.registrarEntradaPorMembresia(42).subscribe();
    const req = httpMock.expectOne(`${BASE}/checkin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idMembresia: 42 });
    req.flush({});
  });

  it('registrarEntradaPorSocio hace POST /checkin con {idSocio}', () => {
    service.registrarEntradaPorSocio(7).subscribe();
    const req = httpMock.expectOne(`${BASE}/checkin`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ idSocio: 7 });
    req.flush({});
  });

  it('registrarEntradaPorHuella hace POST /checkin/huella con {huellaDigital}', () => {
    service.registrarEntradaPorHuella('base64==').subscribe();
    const req = httpMock.expectOne(`${BASE}/checkin/huella`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ huellaDigital: 'base64==' });
    req.flush({});
  });

  it('listarHistorial manda page y size, sin filtros opcionales', () => {
    service.listarHistorial(0, 5).subscribe();
    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.has('q')).toBeFalse();
    expect(req.request.params.has('origen')).toBeFalse();
    req.flush(paginaVacia);
  });

  it('listarHistorial agrega término y origen cuando vienen', () => {
    service.listarHistorial(1, 10, 'ana', 'HUELLA').subscribe();
    const req = httpMock.expectOne(r => r.url === BASE);
    expect(req.request.params.get('q')).toBe('ana');
    expect(req.request.params.get('origen')).toBe('HUELLA');
    req.flush(paginaVacia);
  });

  it('buscar manda desde/hasta solo cuando están AMBAS fechas', () => {
    service.buscar(0, 5, '2026-01-01', '2026-01-31').subscribe();
    const conFechas = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(conFechas.request.params.get('desde')).toBe('2026-01-01');
    expect(conFechas.request.params.get('hasta')).toBe('2026-01-31');
    conFechas.flush(paginaVacia);

    service.buscar(0, 5, '2026-01-01', undefined).subscribe();
    const sinFechas = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(sinFechas.request.params.has('desde')).toBeFalse();
    expect(sinFechas.request.params.has('hasta')).toBeFalse();
    sinFechas.flush(paginaVacia);
  });

  it('buscar agrega nombre cuando viene', () => {
    service.buscar(0, 5, undefined, undefined, 'ana').subscribe();
    const req = httpMock.expectOne(r => r.url === `${BASE}/buscar`);
    expect(req.request.params.get('nombre')).toBe('ana');
    req.flush(paginaVacia);
  });
});
```

- [ ] **Step 2: ANTES de correr — cotejar contra el fuente**

Run: `grep -n "checkin\|params\|append\|desde\|hasta\|nombre\|origen\|\bq\b" src/app/services/check-in-service.ts | head -40`
Expected: confirmar nombres exactos de rutas/params/body. Si algo difiere del spec de arriba, AJUSTA EL TEST al fuente (AS-IS) y anótalo en el reporte.

- [ ] **Step 3: Correr y verificar**

Run: `npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -5`
Expected: `Executed 66 of 66 SUCCESS` (ajusta el total si cambiaste tests en el paso anterior).

- [ ] **Step 4: Commit**

```bash
git add src/app/services/check-in-service.spec.ts
git commit -m "test(): cubrir CheckInService (checkin por membresia/socio/huella y filtros de historial)"
```

---

### Task 10: Verificación final de la oleada

**Files:** ninguno

- [ ] **Step 1: Suite completa + build**

Run: `npm run verificar`
Expected: TODOS los tests SUCCESS (≈66; usa el total real) y build completo con las 2 warnings de presupuesto conocidas.

- [ ] **Step 2: Resumen del diff**

Run: `git log --oneline main..HEAD && git diff main --stat | tail -3`
Expected: ~8 commits; cambios solo en `tsconfig.spec.json`, `package.json`, `app.spec.ts` y 6 archivos `.spec.ts` nuevos.

- [ ] **Step 3: Reportar hallazgos AS-IS acumulados**

Listar en el reporte final (para el dueño): (1) VISITA_10/VISITA_15 caen a +1 mes en `calcularFechaFin`; (2) cualquier discrepancia encontrada en Task 8/9 entre catálogo y fuente; (3) total de tests y tiempo de ejecución de la suite.

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec (Fase 2, alcance 2a):** infra rota de tests ✓ (Tasks 2-3), utilidades puras ✓ (Tasks 4-6: fechas-precios, tiempo-plan-label, ticket-contexto — los 3 nombrados en el spec), carrito ✓ (Task 7, del bullet de lógica de flujos), patrón para los 26 servicios ✓ (Tasks 8-9 fijan el ejemplar; el resto va en el plan 2b), reducers/selectors NgRx → plan 2c (fuera de alcance 2a, documentado), `npm run verificar` ✓ (Task 3, adelantado de la lista de mejoras del spec).
- **Placeholders:** ninguno — todo el código de test está completo; las dos verificaciones "contra el fuente" (Tasks 8-9) son salvaguardas AS-IS con instrucción explícita de qué hacer, no huecos.
- **Consistencia de tipos:** imports relativos verificados contra la estructura real (`util/` → `../model/`, `services/` → `../../environments/`); nombres de métodos tomados del catálogo leído del código fuente en esta sesión.
- **Preferencias-usuario.ts** quedó fuera de 2a a propósito (no está en la lista del spec); si se quiere, entra en 2b/2c.
