// src/app/features/inscripciones/data/calculo-membresia.spec.ts
//
// Cobertura exhaustiva a propósito — este módulo maneja dinero real
// (totales cobrados, descuentos, vigencia de membresías). Ver
// docs/superpowers/plans/2026-08-10-fase-5b-calculo-membresia-service.md
// para las 9 decisiones de negocio que estos tests verifican.

import { PromocionData } from '../../../shared/models/promocion-data';
import { TipoPromocion } from '../../../shared/util/enums/tipo-promocion';
import {
  calcularBeneficioPromo,
  calcularEdadDesdeISO,
  calcularFechaFinConBeneficio,
  calcularTotalMembresia,
  elegirMejorPromocion,
  promoVigente,
  validarPaqueteEstudiantil,
} from './calculo-membresia';

function mkPromo(overrides: Partial<PromocionData> = {}): PromocionData {
  return {
    idPromocion: 1,
    nombre: 'Promo test',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-12-31',
    tipo: TipoPromocion.SIN_BENEFICIO,
    activo: true,
    ...overrides,
  };
}

describe('calculo-membresia', () => {
  // ---------------------------------------------------------------------
  describe('promoVigente', () => {
    const hoy = '2026-06-15';

    it('está vigente cuando hoy cae dentro del rango', () => {
      const p = mkPromo({ fechaInicio: '2026-01-01', fechaFin: '2026-12-31' });
      expect(promoVigente(p, hoy)).toBeTrue();
    });

    it('NO está vigente antes de fechaInicio', () => {
      const p = mkPromo({ fechaInicio: '2026-07-01', fechaFin: '2026-12-31' });
      expect(promoVigente(p, hoy)).toBeFalse();
    });

    it('NO está vigente después de fechaFin', () => {
      const p = mkPromo({ fechaInicio: '2026-01-01', fechaFin: '2026-06-01' });
      expect(promoVigente(p, hoy)).toBeFalse();
    });

    it('vigente si no tiene fechaInicio (solo se valida contra fechaFin)', () => {
      const p = mkPromo({ fechaInicio: '' as any, fechaFin: '2026-12-31' });
      expect(promoVigente(p, hoy)).toBeTrue();
    });

    it('vigente si no tiene fechaFin (solo se valida contra fechaInicio)', () => {
      const p = mkPromo({ fechaInicio: '2026-01-01', fechaFin: '' as any });
      expect(promoVigente(p, hoy)).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------
  describe('elegirMejorPromocion', () => {
    const hoyISO = '2026-06-15';

    it('lista vacía → null', () => {
      expect(elegirMejorPromocion([], { esRenovacion: false, hoyISO })).toBeNull();
    });

    it('una sola promo elegible → esa promo', () => {
      const p = mkPromo({ idPromocion: 7, prioridad: 3 });
      expect(elegirMejorPromocion([p], { esRenovacion: false, hoyISO })).toEqual(p);
    });

    it('empate de prioridad → gana mayor idPromocion (más reciente)', () => {
      const a = mkPromo({ idPromocion: 10, prioridad: 5 });
      const b = mkPromo({ idPromocion: 20, prioridad: 5 });
      const resultado = elegirMejorPromocion([a, b], { esRenovacion: false, hoyISO });
      expect(resultado).toEqual(b);
    });

    it('prioridad distinta → gana mayor prioridad, sin importar cuál tiene mayor idPromocion', () => {
      const alta = mkPromo({ idPromocion: 1, prioridad: 9 });
      const baja = mkPromo({ idPromocion: 99, prioridad: 2 });
      const resultado = elegirMejorPromocion([baja, alta], { esRenovacion: false, hoyISO });
      expect(resultado).toEqual(alta);
    });

    it('DECISIÓN #1 — ejemplo real del negocio: promo A (prioridad=10, 5% de $500 = $25) vs promo B (prioridad=1, 50% de $500 = $250) → gana A a pesar de valer menos dinero', () => {
      const promoA = mkPromo({
        idPromocion: 1,
        prioridad: 10,
        tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
        descuentoPorcentaje: 5,
      });
      const promoB = mkPromo({
        idPromocion: 2,
        prioridad: 1,
        tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
        descuentoPorcentaje: 50,
      });

      const elegida = elegirMejorPromocion([promoA, promoB], { esRenovacion: false, hoyISO });
      expect(elegida).toEqual(promoA);

      // Confirmar que, en efecto, B valía más en pesos — la elección NO es
      // por valor monetario, es a propósito.
      const precioPaquete = 500;
      const beneficioA = calcularBeneficioPromo(promoA, precioPaquete);
      const beneficioB = calcularBeneficioPromo(promoB, precioPaquete);
      expect(beneficioA.descuentoMonto).toBe(25);
      expect(beneficioB.descuentoMonto).toBe(250);
      expect(beneficioB.descuentoMonto).toBeGreaterThan(beneficioA.descuentoMonto);
    });

    it('excluye promo inactiva (activo: false)', () => {
      const inactiva = mkPromo({ idPromocion: 1, prioridad: 100, activo: false });
      const activa = mkPromo({ idPromocion: 2, prioridad: 1, activo: true });
      const resultado = elegirMejorPromocion([inactiva, activa], { esRenovacion: false, hoyISO });
      expect(resultado).toEqual(activa);
    });

    it('excluye promo fuera de rango de vigencia', () => {
      const vencida = mkPromo({
        idPromocion: 1,
        prioridad: 100,
        fechaInicio: '2025-01-01',
        fechaFin: '2025-12-31',
      });
      const vigente = mkPromo({ idPromocion: 2, prioridad: 1 });
      const resultado = elegirMejorPromocion([vencida, vigente], { esRenovacion: false, hoyISO });
      expect(resultado).toEqual(vigente);
    });

    it('esRenovacion=true excluye promos soloNuevos=true', () => {
      const soloNuevos = mkPromo({ idPromocion: 1, prioridad: 100, soloNuevos: true });
      const general = mkPromo({ idPromocion: 2, prioridad: 1, soloNuevos: false });
      const resultado = elegirMejorPromocion([soloNuevos, general], {
        esRenovacion: true,
        hoyISO,
      });
      expect(resultado).toEqual(general);
    });

    it('esRenovacion=false NO excluye promos soloNuevos=true (inscripción es alta nueva)', () => {
      const soloNuevos = mkPromo({ idPromocion: 1, prioridad: 100, soloNuevos: true });
      const resultado = elegirMejorPromocion([soloNuevos], { esRenovacion: false, hoyISO });
      expect(resultado).toEqual(soloNuevos);
    });

    it('DECISIÓN #9 — esRenovacion=true NO excluye una promo por sinCostoInscripcion=true si el resto la hace elegible', () => {
      const conSinCostoInscripcion = mkPromo({
        idPromocion: 1,
        prioridad: 5,
        sinCostoInscripcion: true,
        tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
        descuentoPorcentaje: 20,
      });
      const resultado = elegirMejorPromocion([conSinCostoInscripcion], {
        esRenovacion: true,
        hoyISO,
      });
      expect(resultado).toEqual(conSinCostoInscripcion);
    });
  });

  // ---------------------------------------------------------------------
  describe('calcularBeneficioPromo', () => {
    const precioPaquete = 500;

    it('promo null → resultado en cero/false', () => {
      expect(calcularBeneficioPromo(null, precioPaquete)).toEqual({
        descuentoMonto: 0,
        exentoCostoInscripcion: false,
        mesesGratis: 0,
      });
    });

    it('DESCUENTO_PORCENTAJE calcula el monto sobre el precio del paquete', () => {
      const p = mkPromo({ tipo: TipoPromocion.DESCUENTO_PORCENTAJE, descuentoPorcentaje: 10 });
      const b = calcularBeneficioPromo(p, precioPaquete);
      expect(b.descuentoMonto).toBe(50);
      expect(b.mesesGratis).toBe(0);
    });

    it('DESCUENTO_MONTO usa el monto fijo directamente', () => {
      const p = mkPromo({ tipo: TipoPromocion.DESCUENTO_MONTO, descuentoMonto: 75 });
      const b = calcularBeneficioPromo(p, precioPaquete);
      expect(b.descuentoMonto).toBe(75);
      expect(b.mesesGratis).toBe(0);
    });

    it('MESES_GRATIS otorga mesesGratis y descuentoMonto se queda en 0 (dinero y tiempo son dimensiones distintas)', () => {
      const p = mkPromo({ tipo: TipoPromocion.MESES_GRATIS, mesesGratis: 2 });
      const b = calcularBeneficioPromo(p, precioPaquete);
      expect(b.mesesGratis).toBe(2);
      expect(b.descuentoMonto).toBe(0);
    });

    it('SIN_BENEFICIO no otorga descuento ni meses gratis', () => {
      const p = mkPromo({ tipo: TipoPromocion.SIN_BENEFICIO });
      const b = calcularBeneficioPromo(p, precioPaquete);
      expect(b.descuentoMonto).toBe(0);
      expect(b.mesesGratis).toBe(0);
    });

    it('sinCostoInscripcion es independiente del tipo de descuento (puede coexistir con DESCUENTO_PORCENTAJE)', () => {
      const p = mkPromo({
        tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
        descuentoPorcentaje: 15,
        sinCostoInscripcion: true,
      });
      const b = calcularBeneficioPromo(p, precioPaquete);
      expect(b.descuentoMonto).toBe(75);
      expect(b.exentoCostoInscripcion).toBeTrue();
    });

    it('mesesGratis es 0 para los 3 tipos que no son MESES_GRATIS', () => {
      const tipos = [
        TipoPromocion.DESCUENTO_PORCENTAJE,
        TipoPromocion.DESCUENTO_MONTO,
        TipoPromocion.SIN_BENEFICIO,
      ];
      for (const tipo of tipos) {
        const p = mkPromo({ tipo, mesesGratis: 3 /* no debería usarse igual */ });
        expect(calcularBeneficioPromo(p, precioPaquete).mesesGratis).toBe(0);
      }
    });

    it('MESES_GRATIS + sinCostoInscripcion coexisten: ambos beneficios se otorgan a la vez', () => {
      const p = mkPromo({
        tipo: TipoPromocion.MESES_GRATIS,
        mesesGratis: 1,
        sinCostoInscripcion: true,
      });
      const b = calcularBeneficioPromo(p, precioPaquete);
      expect(b.mesesGratis).toBe(1);
      expect(b.exentoCostoInscripcion).toBeTrue();
      expect(b.descuentoMonto).toBe(0);
    });

    it('descuentoPorcentaje/descuentoMonto negativos nunca producen un descuentoMonto negativo', () => {
      const conPorcentajeNegativo = mkPromo({
        tipo: TipoPromocion.DESCUENTO_PORCENTAJE,
        descuentoPorcentaje: -10,
      });
      expect(calcularBeneficioPromo(conPorcentajeNegativo, precioPaquete).descuentoMonto).toBe(0);

      const conMontoNegativo = mkPromo({
        tipo: TipoPromocion.DESCUENTO_MONTO,
        descuentoMonto: -75,
      });
      expect(calcularBeneficioPromo(conMontoNegativo, precioPaquete).descuentoMonto).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  describe('calcularTotalMembresia', () => {
    it('descuento manual negativo se clampa a 0 (no infla el total)', () => {
      const resultado = calcularTotalMembresia({
        precioPaquete: 500,
        costoInscripcion: 0,
        descuentoManual: -100,
        promo: null,
      });
      // Si NO se clampara, total sería 500 - (-100) = 600 (¡inflado!).
      expect(resultado.total).toBe(500);
      expect(resultado.descuentoTotal).toBe(0);
    });

    it('descuento de promo y descuento manual se suman', () => {
      const promo = mkPromo({ tipo: TipoPromocion.DESCUENTO_MONTO, descuentoMonto: 30 });
      const resultado = calcularTotalMembresia({
        precioPaquete: 500,
        costoInscripcion: 0,
        descuentoManual: 20,
        promo,
      });
      expect(resultado.descuentoTotal).toBe(50);
      expect(resultado.total).toBe(450);
    });

    it('exentoCostoInscripcion pone el costo de inscripción en 0', () => {
      const promo = mkPromo({ sinCostoInscripcion: true, tipo: TipoPromocion.SIN_BENEFICIO });
      const resultado = calcularTotalMembresia({
        precioPaquete: 500,
        costoInscripcion: 150,
        descuentoManual: 0,
        promo,
      });
      // Sin la exención el total sería 650; con exención el costoInscripcion
      // efectivo es 0.
      expect(resultado.total).toBe(500);
    });

    it('ejemplo completo trabajado a mano: paquete $800 + inscripción $150, promo 10% + descuento manual $20', () => {
      // Cálculo a mano (para que un revisor pueda verificarlo sin correr el
      // test):
      //   precioPaquete            = 800
      //   costoInscripcion         = 150
      //   promo DESCUENTO_PORCENTAJE 10% sobre 800 = 80  → descuentoMonto promo
      //   descuentoManual           = 20
      //   descuentoTotal            = 80 + 20 = 100
      //   total = max(0, precio + costoInscripcion - descuentoTotal)
      //         = max(0, 800 + 150 - 100)
      //         = 850
      const promo = mkPromo({ tipo: TipoPromocion.DESCUENTO_PORCENTAJE, descuentoPorcentaje: 10 });
      const resultado = calcularTotalMembresia({
        precioPaquete: 800,
        costoInscripcion: 150,
        descuentoManual: 20,
        promo,
      });

      expect(resultado.beneficioPromo.descuentoMonto).toBe(80);
      expect(resultado.descuentoTotal).toBe(100);
      expect(resultado.total).toBe(850);
    });
  });

  // ---------------------------------------------------------------------
  describe('calcularFechaFinConBeneficio', () => {
    it('mesesGratis=0 se comporta igual que llamar a calcularFechaFin directamente', () => {
      // Plan MENSUAL (UN_MES) desde 2026-01-15 → 2026-02-15.
      const resultado = calcularFechaFinConBeneficio('2026-01-15', 'UN_MES', 0);
      expect(resultado).toBe('2026-02-15');
    });

    it('mesesGratis > 0 suma sobre la fecha de fin YA calculada, no sobre la fecha de inicio cruda', () => {
      // Plan MENSUAL desde 2026-01-15 → fin base 2026-02-15. Con 2 meses
      // gratis debe quedar 2026-04-15 (2026-02-15 + 2 meses).
      //
      // Si alguien accidentalmente sumara los meses gratis sobre la fecha
      // de INICIO cruda (2026-01-15 + 1 mes de plan + 2 meses gratis mal
      // aplicados = 2026-01-15 + 2 meses = 2026-03-15, ignorando el mes del
      // plan), este test fallaría porque esperamos 2026-04-15, no
      // 2026-03-15.
      const resultado = calcularFechaFinConBeneficio('2026-01-15', 'UN_MES', 2);
      expect(resultado).toBe('2026-04-15');
      expect(resultado).not.toBe('2026-03-15');
    });
  });

  // ---------------------------------------------------------------------
  describe('calcularEdadDesdeISO', () => {
    it('calcula la edad correctamente cuando ya pasó el cumpleaños este año', () => {
      expect(calcularEdadDesdeISO('2000-01-01', '2026-06-15')).toBe(26);
    });

    it('calcula la edad correctamente cuando el cumpleaños es HOY', () => {
      expect(calcularEdadDesdeISO('2000-06-15', '2026-06-15')).toBe(26);
    });

    it('resta un año si el cumpleaños todavía no llega este año', () => {
      expect(calcularEdadDesdeISO('2000-12-25', '2026-06-15')).toBe(25);
    });
  });

  // ---------------------------------------------------------------------
  describe('validarPaqueteEstudiantil', () => {
    const hoyISO = '2026-06-15';
    const calcularEdad = calcularEdadDesdeISO;

    it('paquete NO estudiantil siempre es válido, sin importar el resto de los parámetros', () => {
      const resultado = validarPaqueteEstudiantil({
        esPaqueteEstudiantil: false,
        fechaNacimientoISO: null,
        credencialVigenciaISO: null,
        hoyISO,
        calcularEdad,
      });
      expect(resultado.valido).toBeTrue();
      expect(resultado.motivo).toBeUndefined();
    });

    it('estudiantil sin fecha de nacimiento → inválido con el mensaje exacto', () => {
      const resultado = validarPaqueteEstudiantil({
        esPaqueteEstudiantil: true,
        fechaNacimientoISO: null,
        credencialVigenciaISO: '2026-12-31',
        hoyISO,
        calcularEdad,
      });
      expect(resultado.valido).toBeFalse();
      expect(resultado.motivo).toBe('Para paquete estudiantil se requiere fecha de nacimiento.');
    });

    it('edad <=22 con credencial vigente y no vencida → válido', () => {
      const resultado = validarPaqueteEstudiantil({
        esPaqueteEstudiantil: true,
        fechaNacimientoISO: '2005-01-01', // 21 años al 2026-06-15
        credencialVigenciaISO: '2026-12-31',
        hoyISO,
        calcularEdad,
      });
      expect(resultado.valido).toBeTrue();
      expect(resultado.motivo).toBeUndefined();
    });

    it('edad >22 → inválido con la edad exacta en el mensaje', () => {
      const resultado = validarPaqueteEstudiantil({
        esPaqueteEstudiantil: true,
        fechaNacimientoISO: '2000-01-01', // 26 años al 2026-06-15
        credencialVigenciaISO: '2026-12-31',
        hoyISO,
        calcularEdad,
      });
      expect(resultado.valido).toBeFalse();
      expect(resultado.motivo).toBe('Paquete estudiantil solo aplica hasta 22 años. Edad actual: 26.');
    });

    it('sin vigencia de credencial (null) → inválido con el mensaje exacto', () => {
      const resultado = validarPaqueteEstudiantil({
        esPaqueteEstudiantil: true,
        fechaNacimientoISO: '2005-01-01',
        credencialVigenciaISO: null,
        hoyISO,
        calcularEdad,
      });
      expect(resultado.valido).toBeFalse();
      expect(resultado.motivo).toBe('Para paquete estudiantil se requiere la vigencia de la credencial.');
    });

    it('credencial vencida (vigencia < hoy) → inválido con el mensaje exacto', () => {
      const resultado = validarPaqueteEstudiantil({
        esPaqueteEstudiantil: true,
        fechaNacimientoISO: '2005-01-01',
        credencialVigenciaISO: '2026-01-01',
        hoyISO,
        calcularEdad,
      });
      expect(resultado.valido).toBeFalse();
      expect(resultado.motivo).toBe('Credencial de estudiante vencida (vigencia: 2026-01-01).');
    });
  });
});
