export enum TipoPromocion {
  DESCUENTO_PORCENTAJE = 'DESCUENTO_PORCENTAJE',
  DESCUENTO_MONTO = 'DESCUENTO_MONTO',
  MESES_GRATIS = 'MESES_GRATIS',
}

export function labelTipoPromocion(tipo?: TipoPromocion | string | null): string {
  const t = String(tipo ?? '').toUpperCase();
  switch (t) {
    case TipoPromocion.DESCUENTO_PORCENTAJE:
      return 'Descuento (%)';
    case TipoPromocion.DESCUENTO_MONTO:
      return 'Descuento ($)';
    case TipoPromocion.MESES_GRATIS:
      return 'Meses gratis';
    default:
      return tipo ? String(tipo) : '—';
  }
}
