// src/app/features/inscripciones/data/calculo-membresia.ts
//
// Módulo de funciones puras (sin @Injectable, sin estado, mismo estilo que
// shared/util/fechas-precios.ts) que consolida la lógica de selección de
// promociones, cálculo de descuentos/total, extensión de vigencia por meses
// gratis y validación de paquete estudiantil. Hoy esta lógica está
// implementada 3 veces (inscripcion.ts, reinscripcion.ts,
// reinscripcion-adelantada.ts) de forma independiente e inconsistente — este
// módulo es la única fuente de verdad que las 3 pantallas deben consumir.
//
// Ver docs/superpowers/plans/2026-08-10-fase-5b-calculo-membresia-service.md
// para las 9 decisiones de negocio que este módulo implementa (1, 3, 4, 6,
// 7, 9 directamente; 5 y 8 se apoyan en las piezas de acá pero se resuelven
// en los componentes consumidores, Tasks 3-5).

import { PromocionData } from '../../../shared/models/promocion-data';
import { TipoPromocion } from '../../../shared/util/enums/tipo-promocion';
import { calcularFechaFin, calcularTotal } from '../../../shared/util/fechas-precios';
import { TiempoPlan } from '../../../shared/util/enums/tiempo-plan';

/** ¿La promoción está vigente hoy según su rango de fechas? (`activo` se
 * revisa aparte, en `elegirMejorPromocion` — esta función solo mira
 * fechaInicio/fechaFin). Tolera timestamps ISO completos truncando a la
 * parte de fecha (YYYY-MM-DD), igual que hacía `promoVigenteHoy` en
 * inscripcion.ts. */
export function promoVigente(promo: PromocionData, hoyISO: string): boolean {
  const ini = String(promo?.fechaInicio ?? '').split('T')[0];
  const fin = String(promo?.fechaFin ?? '').split('T')[0];
  if (ini && hoyISO < ini) return false;
  if (fin && hoyISO > fin) return false;
  return true;
}

export interface OpcionesElegibilidadPromo {
  /** true en reinscripción/reinscripción adelantada — excluye promos "solo
   * nuevos". NO excluye por `sinCostoInscripcion` (decisión de negocio #9:
   * ese campo es un componente de beneficio independiente, no un criterio
   * de elegibilidad). */
  esRenovacion: boolean;
  hoyISO: string;
}

/** Elige la "mejor" promoción entre las activas+vigentes+elegibles, por
 * `prioridad` DESC (mayor prioridad gana), empate por `idPromocion` DESC
 * (la más reciente gana). Decisión de negocio #1: por PRIORIDAD, no por
 * valor monetario — a propósito no hay ningún cálculo de "cuánto vale en
 * pesos" acá, eso queda en calcularBeneficioPromo/calcularTotalMembresia,
 * que son cosas completamente separadas de la selección. */
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
 * INDEPENDIENTES entre sí (decisión de negocio #3 y #9: una promo puede dar
 * descuento en dinero Y exentar el costo de inscripción Y dar meses gratis
 * simultáneamente — no son mutuamente excluyentes, ni siquiera están
 * atados al mismo `tipo`: `sinCostoInscripcion` es un flag aparte de
 * `tipo`). `mesesGratis` solo es > 0 cuando `tipo === MESES_GRATIS`
 * (meses y dinero son dimensiones distintas — una promo de tipo
 * MESES_GRATIS no otorga descuentoMonto). */
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
 * calcularTotal() ya existente y probada en fechas-precios.ts (decisión de
 * negocio #7 — no se reimplementa esa aritmética). Clampa el descuento
 * manual a >= 0 (decisión de negocio #6 — nunca debe poder INFLAR el
 * total). */
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
 * una promo (si aplica). Decisión de negocio #3: los meses gratis se suman
 * SOBRE la fecha de fin YA calculada por calcularFechaFin() (que ya sumó la
 * duración del plan), no sobre la fecha de inicio cruda — no modifica ni
 * reimplementa calcularFechaFin(), solo la compone. */
export function calcularFechaFinConBeneficio(
  fechaInicioISO: string,
  tiempo: TiempoPlan | string | null | undefined,
  mesesGratis: number,
): string {
  const finBase = calcularFechaFin(fechaInicioISO, tiempo);
  if (!mesesGratis || mesesGratis <= 0) return finBase;

  const d = new Date(finBase + 'T00:00:00');
  d.setMonth(d.getMonth() + mesesGratis);
  return d.toISOString().slice(0, 10);
}

/** Edad en años cumplidos a partir de una fecha de nacimiento ISO
 * (YYYY-MM-DD), comparada contra una fecha "hoy" también ISO. El algoritmo
 * de comparación (diferencia de año, ajuste por mes/día, clamp a 0) es el
 * mismo que el `calcularEdadDesdeISO` privado de inscripcion.ts — la única
 * diferencia es la firma: acá `hoy` se recibe como string ISO en vez de
 * `Date`, para que calce EXACTAMENTE con el tipo `calcularEdad` que pide
 * `ParametrosValidacionEstudiantil` de abajo (ambas fechas como ISO, igual
 * que el resto de este módulo) y así los 3 componentes puedan pasar esta
 * función directamente sin un wrapper.
 *
 * DECISIÓN (dejada abierta en el plan, Task 2): se exporta acá como función
 * compartida en vez de dejarla privada en inscripcion.ts e inyectarla desde
 * ahí como callback en las otras 2 pantallas. Motivo: es lógica de cálculo
 * puro sin ninguna dependencia de Angular/DI ni de este componente en
 * particular — exactamente el tipo de código que este módulo existe para
 * consolidar. Dejarla privada en inscripcion.ts obligaría a las otras 2
 * pantallas a importarla desde un componente hermano (peor acoplamiento
 * que centralizarla acá) o a reimplementarla (justo la duplicación que esta
 * oleada busca eliminar). validarPaqueteEstudiantil() de todas formas
 * sigue recibiendo `calcularEdad` como parámetro (no la importa
 * internamente) para mantenerse 100% pura y fácil de testear con cualquier
 * implementación de edad — los 3 componentes consumidores le pasan esta
 * misma función exportada. */
export function calcularEdadDesdeISO(fechaNacimientoISO: string, hoyISO: string): number {
  const parts = String(fechaNacimientoISO ?? '')
    .split('-')
    .map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;

  const [y, m, d] = parts;
  const birth = new Date(y, (m ?? 1) - 1, d ?? 1);

  const hoyParts = String(hoyISO ?? '')
    .split('-')
    .map((x) => Number(x));
  const hoy =
    hoyParts.length === 3 && hoyParts.every((n) => !Number.isNaN(n))
      ? new Date(hoyParts[0], (hoyParts[1] ?? 1) - 1, hoyParts[2] ?? 1)
      : new Date();

  let edad = hoy.getFullYear() - birth.getFullYear();
  const mDiff = hoy.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && hoy.getDate() < birth.getDate())) edad--;

  return Math.max(0, edad);
}

export interface ParametrosValidacionEstudiantil {
  /** SOLO paquete.estudiantil === true (decisión de negocio #4) — sin
   * heurísticas de nombre/tipo. El componente consumidor es quien decide
   * cómo determinó este booleano; esta función es agnóstica a eso. */
  esPaqueteEstudiantil: boolean;
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
 * estudiantiles. Pura — sin toasts/notificaciones: el componente que la
 * llama decide cómo mostrar `motivo` (ej.
 * this.notificacion.error(resultado.motivo)). Si el paquete no es
 * estudiantil, siempre válido (no aplica ninguna regla). */
export function validarPaqueteEstudiantil(
  params: ParametrosValidacionEstudiantil,
): ResultadoValidacionEstudiantil {
  if (!params.esPaqueteEstudiantil) return { valido: true };

  if (!params.fechaNacimientoISO) {
    return { valido: false, motivo: 'Para paquete estudiantil se requiere fecha de nacimiento.' };
  }

  const edad = params.calcularEdad(params.fechaNacimientoISO, params.hoyISO);
  if (edad > 22) {
    return {
      valido: false,
      motivo: `Paquete estudiantil solo aplica hasta 22 años. Edad actual: ${edad}.`,
    };
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
