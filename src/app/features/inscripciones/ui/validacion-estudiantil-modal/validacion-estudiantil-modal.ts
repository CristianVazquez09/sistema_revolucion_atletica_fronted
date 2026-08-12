// src/app/features/inscripciones/ui/validacion-estudiantil-modal/validacion-estudiantil-modal.ts
// Presentacional: modal de remediacion de credencial estudiantil vencida
// (solo reinscripcion.ts). La llamada HTTP real y la generacion de checks
// se quedan en la pagina; este componente solo emite eventos.
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstudiantilCheck } from '../../pages/reinscripcion/reinscripcion';

@Component({
  selector: 'app-validacion-estudiantil-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './validacion-estudiantil-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidacionEstudiantilModal {
  visible = input(false);
  checks = input<EstudiantilCheck[]>([]);
  vigenciaPorSocio = input<Record<string, string>>({});
  guardandoPorSocio = input<Record<string, boolean>>({});
  puedeContinuar = input(false);
  today = input('');

  cerrar = output<void>();
  continuar = output<void>();
  vigenciaCambio = output<{ socioId: number; value: string }>();
  guardarVigencia = output<number>();

  vigenciaDe(socioId: number): string {
    return this.vigenciaPorSocio()[String(socioId)] ?? this.today();
  }

  guardandoDe(socioId: number): boolean {
    return Boolean(this.guardandoPorSocio()[String(socioId)]);
  }

  onVigenciaInput(socioId: number, value: string): void {
    this.vigenciaCambio.emit({ socioId, value });
  }
}
