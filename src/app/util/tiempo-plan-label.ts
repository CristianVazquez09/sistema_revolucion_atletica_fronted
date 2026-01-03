// src/app/shared/pipes/tiempo-plan-label.pipe.ts
import { Pipe, PipeTransform } from '@angular/core'; // <- ojo la ruta
import { TiempoPlan } from './enums/tiempo-plan';

@Pipe({
  name: 'tiempoPlan',
  standalone: true
})
export class TiempoPlanLabelPipe implements PipeTransform {

  private readonly MAP: Record<string, string> = {
    // Aliases legacy
    'VISTA': 'Visita',

    // Base
    'VISITA': 'Visita',
    'DIEZ_DIAS': '10 días',
    'QUINCE_DIAS': '15 días',
    'UNA_SEMANA': '1 semana',
    'DOS_SEMANAS': '2 semanas',
    'UN_MES': '1 mes',
    'TRES_MESES': '3 meses',
    'SEIS_MESES': '6 meses',
    'UN_ANIO': '1 año',

    // Aliases “bonitos” que ya usabas
    'MENSUAL': 'Mensual',
    'TRIMESTRAL': 'Trimestral',
    'SEMESTRAL': 'Semestral',
    'ANUAL': 'Anual',

    // NUEVOS planes por visitas
    'VISITA_10': '10 visitas (2 meses)',
    'VISITA_15': '15 visitas (2 meses)',
  };

  transform(v: TiempoPlan | string | null | undefined): string {
    if (v == null) return '';
    const key = String(v).toUpperCase();
    if (this.MAP[key]) return this.MAP[key];

    // Fallback: "DOS_SEMANAS" -> "Dos Semanas"
    return key
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
