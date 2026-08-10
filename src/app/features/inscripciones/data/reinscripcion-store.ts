// src/app/features/inscripciones/data/reinscripcion-store.ts
import { Injectable, computed, signal } from '@angular/core';
import { PaqueteData } from '../../../shared/models/paquete-data';

// ✅ Replica el comportamiento del reducer de NgRx: `initialReinscripcionState.fechaInicio`
// se calcula UNA sola vez cuando el módulo se carga (constante a nivel de módulo), y
// `reset` restaura ese mismo valor congelado (`{ ...initialReinscripcionState }`), NO
// recalcula "hoy" de nuevo en cada reset. Se preserva la misma semántica aquí.
const FECHA_INICIO_INICIAL = new Date().toISOString().slice(0, 10);

/**
 * Store de signals para el flujo de Reinscripción. Reemplaza el store de NgRx
 * (reinscripcion-actions/reducer/selectors/models.ts) con el mismo patrón que
 * CarritoService / InscripcionStore: signals privados de escritura + computed
 * públicos de solo lectura + métodos nombrados para mutar.
 *
 * ⚠️ Cero cambios de comportamiento respecto al store de NgRx que reemplaza. Los
 * selectores de reinscripción son DELIBERADAMENTE más simples que los de
 * inscripción (ver tabla en docs/superpowers/plans/2026-08-10-fase-5a-salida-de-ngrx.md)
 * — NO se "corrigen" ni se unifican aquí:
 *   - `paqueteActual` compara `Number(p.idPaquete) === Number(id)` directo, sin el
 *     helper `getId` de múltiples llaves que usa inscripción.
 *   - `precioPaquete` no tiene el `|| 0` extra de guarda anti-NaN de inscripción.
 *   - No existe `costoInscripcion` en este store.
 *   - `totalSinDescuento` devuelve el precio crudo, sin pasar por `calcularTotal`.
 *   - `totalVista` usa `Math.max(0, precio - descuento)` en vez de `calcularTotal`
 *     (sin redondeo, sin sumar costo de inscripción).
 *   - `fechaPagoVista` es un eco de `fechaInicio`.
 */
@Injectable({ providedIn: 'root' })
export class ReinscripcionStore {
  private readonly listaPaquetesSig = signal<PaqueteData[]>([]);
  private readonly paqueteIdSig = signal<number>(0);
  private readonly descuentoSig = signal<number>(0); // ✅ MONTO, no porcentaje
  private readonly fechaInicioSig = signal<string>(FECHA_INICIO_INICIAL);

  // ---- Estado base (equivalentes a selectListaPaquetes/selectPaqueteId/selectDescuento/selectFechaInicio) ----
  readonly listaPaquetes = computed(() => this.listaPaquetesSig());
  readonly paqueteId = computed(() => this.paqueteIdSig());
  readonly descuento = computed(() => this.descuentoSig());
  readonly fechaInicio = computed(() => this.fechaInicioSig());

  // ---- Derivados (replican selectPaqueteActual/selectPrecioPaquete/... ) ----

  // selectPaqueteActual: lista.find((p) => Number(p.idPaquete) === Number(id)) ?? null
  // AS-IS (negocio): SIN el helper getId de múltiples llaves que usa inscripción.
  readonly paqueteActual = computed(() => {
    const id = this.paqueteIdSig();
    return this.listaPaquetesSig().find((p) => Number(p.idPaquete) === Number(id)) ?? null;
  });

  // selectPrecioPaquete: Number(p?.precio ?? 0)
  // AS-IS (negocio): SIN el `|| 0` extra que tiene inscripción.
  readonly precioPaquete = computed(() => Number(this.paqueteActual()?.precio ?? 0));

  // No existe selectCostoInscripcion en reinscripción — no se agrega aquí.

  // selectTotalSinDescuento: (precio) => precio
  // AS-IS (negocio): precio crudo, sin costoInscripcion, sin pasar por calcularTotal.
  readonly totalSinDescuento = computed(() => this.precioPaquete());

  // selectTotalVista: Math.max(0, Number(precio) - Number(descuento || 0))
  // AS-IS (negocio): fórmula propia de reinscripción, sin calcularTotal, sin
  // redondeo, sin costo de inscripción.
  readonly totalVista = computed(() =>
    Math.max(0, this.precioPaquete() - (this.descuentoSig() || 0)),
  );

  // selectFechaPagoVista: (f) => f
  // AS-IS (negocio): devuelve fechaInicio tal cual — NO calcula una fecha de fin
  // (a diferencia de inscripción, que usa calcularFechaFin). El nombre sugiere que
  // debería ser la fecha de fin del plan, pero el selector original que reemplaza
  // simplemente hace eco de la fecha de inicio. Esto es una inconsistencia de
  // negocio preexistente y conocida — corregirla queda fuera de esta oleada
  // (Fase 5a, salida de NgRx); se abordará en una futura oleada de consolidación
  // de `calculo-membresia-service`.
  readonly fechaPagoVista = computed(() => this.fechaInicio());

  // ---- Mutadores (equivalentes a ReinscripcionActions.set*/reset) ----

  establecerListaPaquetes(paquetes: PaqueteData[]): void {
    this.listaPaquetesSig.set(paquetes);
  }

  establecerPaqueteId(paqueteId: number): void {
    this.paqueteIdSig.set(paqueteId);
  }

  establecerDescuento(descuento: number): void {
    this.descuentoSig.set(descuento);
  }

  establecerFechaInicio(fechaInicio: string): void {
    this.fechaInicioSig.set(fechaInicio);
  }

  reiniciar(): void {
    this.listaPaquetesSig.set([]);
    this.paqueteIdSig.set(0);
    this.descuentoSig.set(0);
    this.fechaInicioSig.set(FECHA_INICIO_INICIAL);
  }
}
