// src/app/features/inscripciones/ui/selector-paquete/selector-paquete.ts
// Presentacional: input de búsqueda + dropdown de sugerencias de paquete.
// No calcula nada (precio/promo/total siguen viviendo en cada página);
// solo emite eventos de interacción del usuario.
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaqueteData } from '../../../../shared/models/paquete-data';
import { TiempoPlanLabelPipe } from '../../../../shared/util/tiempo-plan-label';

function modalidadTextoCorta(modalidad: unknown): string {
  const m = String(modalidad ?? 'INDIVIDUAL').toUpperCase();
  if (m === 'DUO') return 'Dúo (2)';
  if (m === 'TRIO') return 'Trío (3)';
  if (m === 'SQUAD') return 'Squad (5)';
  return 'Individual (1)';
}

@Component({
  selector: 'app-selector-paquete',
  standalone: true,
  imports: [CommonModule, TiempoPlanLabelPipe],
  templateUrl: './selector-paquete.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorPaquete {
  paquetes = input<PaqueteData[]>([]);
  busqueda = input('');
  abierto = input(false);
  bloqueado = input(false);
  cargando = input(false);
  /** Solo inscripción: búsqueda remota en curso. */
  buscando = input(false);
  /** Solo inscripción: error de la búsqueda remota. */
  errorBusqueda = input<string | null>(null);
  /** Solo inscripción: muestra modalidad + "Estudiantil" bajo cada sugerencia. */
  mostrarDetalle = input(false);
  placeholder = input('Escribe para buscar paquete…');

  busquedaChange = output<string>();
  abrirDropdown = output<void>();
  seleccionar = output<PaqueteData>();
  limpiar = output<MouseEvent>();

  modalidadTexto(modalidad: unknown): string {
    return modalidadTextoCorta(modalidad);
  }

  onInput(value: string): void {
    this.busquedaChange.emit(value);
  }

  onSeleccionar(p: PaqueteData, evt: Event): void {
    evt.stopPropagation();
    this.seleccionar.emit(p);
  }

  onLimpiar(evt: MouseEvent): void {
    this.limpiar.emit(evt);
  }
}
