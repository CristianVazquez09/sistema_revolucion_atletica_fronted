import { TiempoPlan } from './enums/tiempo-plan';

export function hoyISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}


export function calcularFechaFin(
  inicioISO: string,
  tiempo?: TiempoPlan | string | null
): string {
  if (!inicioISO) return hoyISO();
  const d = new Date(inicioISO + 'T00:00:00');
  const t = String(tiempo ?? '').toUpperCase();

  // Helpers
  const addDays   = (n: number) => d.setDate(d.getDate() + n);
  const addMonths = (n: number) => d.setMonth(d.getMonth() + n);
  const addYears  = (n: number) => d.setFullYear(d.getFullYear() + n);

  switch (t) {
    // Tu enum:
    // VISTA = 'VISITA'
    case 'VISTA': case 'VISITA': addDays(1); break;

    case 'DIEZ_DIAS':     addDays(10); break;
    case 'QUINCE_DIAS':   addDays(15); break;

    case 'UNA_SEMANA':    addDays(7);  break;
    case 'DOS_SEMANAS':   addDays(14); break;

    case 'MENSUAL':       // por si llega la clave
    case 'UN_MES':        addMonths(1); break;

    case 'TRIMESTRAL':    // alias amable
    case 'TRES_MESES':    addMonths(3); break;

    case 'SEMESTRAL':
    case 'SEIS_MESES':    addMonths(6); break;

    case 'ANUAL':
    case 'UN_ANIO':       addYears(1);  break;

    default:              addMonths(1);  break; // fallback razonable
  }
  return d.toISOString().slice(0, 10);
}

export function calcularTotal(
  precioPaquete: number,
  descuento = 0,
  costoInscripcion = 0
): number {
  const n = Math.max(0, (precioPaquete || 0) + (costoInscripcion || 0) - (descuento || 0));
  return Math.round(n * 100) / 100;
}

export function dateLocalFromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1); // medianoche local
}

