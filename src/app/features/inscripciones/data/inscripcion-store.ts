// src/app/features/inscripciones/data/inscripcion-store.ts
import { Injectable, computed, signal } from '@angular/core';
import { PaqueteData } from '../../../shared/models/paquete-data';
import { calcularFechaFin, calcularTotal } from '../../../shared/util/fechas-precios';

// ✅ Replica byte-a-byte el helper de src/app/pages/inscripcion/state/inscripcion-selectors.ts
// Soporta string/number y llaves alternativas (idPaquete/paqueteId/id/id_paquete).
const getId = (p: any): number => {
  const raw = p?.idPaquete ?? p?.paqueteId ?? p?.id ?? p?.id_paquete ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

// ✅ Replica el comportamiento del reducer de NgRx: `initialInscripcionState.fechaInicio`
// se calcula UNA sola vez cuando el módulo se carga (constante a nivel de módulo), y
// `reset` restaura ese mismo valor congelado (`{ ...initialInscripcionState }`), NO
// recalcula "hoy" de nuevo en cada reset. Se preserva la misma semántica aquí: la fecha
// inicial se captura una única vez a nivel de módulo y `reiniciar()` reutiliza ese mismo
// valor, en vez de invocar `new Date()` de nuevo.
const FECHA_INICIO_INICIAL = new Date().toISOString().slice(0, 10);

/**
 * Store de signals para el flujo de Inscripción. Reemplaza el store de NgRx
 * (inscripcion-actions/reducer/selectors/models.ts) con el mismo patrón que
 * CarritoService: signals privados de escritura + computed públicos de solo
 * lectura + métodos nombrados para mutar. Cero cambios de comportamiento
 * respecto al store de NgRx que reemplaza — cada computed replica la fórmula
 * EXACTA del selector correspondiente.
 */
@Injectable({ providedIn: 'root' })
export class InscripcionStore {
  private readonly listaPaquetesSig = signal<PaqueteData[]>([]);
  private readonly paqueteIdSig = signal<number>(0);
  private readonly descuentoSig = signal<number>(0); // ✅ MONTO, no porcentaje
  private readonly fechaInicioSig = signal<string>(FECHA_INICIO_INICIAL);

  // ---- Estado base (equivalentes a selectListaPaquetes/selectPaqueteId/selectDescuento/selectFechaInicio) ----
  readonly listaPaquetes = computed(() => this.listaPaquetesSig());
  readonly paqueteId = computed(() => this.paqueteIdSig());
  readonly descuento = computed(() => this.descuentoSig());
  readonly fechaInicio = computed(() => this.fechaInicioSig());

  // ---- Derivados (replican selectPaqueteActual/selectPrecioPaquete/selectCostoInscripcion/... ) ----

  // selectPaqueteActual: (lista ?? []).find((p) => getId(p) === Number(id ?? 0)) ?? null
  readonly paqueteActual = computed(() => {
    const pid = Number(this.paqueteIdSig() ?? 0);
    return (this.listaPaquetesSig() ?? []).find((p: any) => getId(p) === pid) ?? null;
  });

  // selectPrecioPaquete: Number(p?.precio ?? 0) || 0
  readonly precioPaquete = computed(() => Number((this.paqueteActual() as any)?.precio ?? 0) || 0);

  // selectCostoInscripcion: Number(p?.costoInscripcion ?? 0) || 0
  readonly costoInscripcion = computed(
    () => Number((this.paqueteActual() as any)?.costoInscripcion ?? 0) || 0,
  );

  // selectTotalVista: calcularTotal(Number(precio) || 0, Number(descuento) || 0, Number(insc) || 0)
  readonly totalVista = computed(() =>
    calcularTotal(
      Number(this.precioPaquete()) || 0,
      Number(this.descuentoSig()) || 0,
      Number(this.costoInscripcion()) || 0,
    ),
  );

  // selectTotalSinDescuento: calcularTotal(Number(precio) || 0, 0, Number(insc) || 0)
  readonly totalSinDescuento = computed(() =>
    calcularTotal(Number(this.precioPaquete()) || 0, 0, Number(this.costoInscripcion()) || 0),
  );

  // selectFechaPagoVista: calcularFechaFin(String(inicio ?? ''), p?.tiempo ?? null)
  readonly fechaPagoVista = computed(() =>
    calcularFechaFin(
      String(this.fechaInicioSig() ?? ''),
      (this.paqueteActual() as any)?.tiempo ?? null,
    ),
  );

  // ---- Mutadores (equivalentes a InscripcionActions.set*/reset) ----

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
