// src/app/features/inscripciones/ui/entrenador-ra-selector/entrenador-ra-selector.ts
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { EntrenadorService } from '../../../asesorias/data/entrenador-service';
import { EntrenadorData } from '../../../../shared/models/entrenador-data';

@Component({
  selector: 'app-entrenador-ra-selector',
  standalone: true,
  imports: [],
  templateUrl: './entrenador-ra-selector.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntrenadorRaSelector implements OnInit {
  private entrenadorSrv = inject(EntrenadorService);

  esPaqueteRA = input(false);
  entrenadorId = input<number | null>(null);

  entrenadorIdChange = output<number | null>();
  entrenadoresCargados = output<EntrenadorData[]>();

  entrenadoresSig = signal<EntrenadorData[]>([]);
  cargandoSig = signal(false);

  ngOnInit(): void {
    this.cargarEntrenadoresRA();
  }

  private cargarEntrenadoresRA(): void {
    this.cargandoSig.set(true);
    this.entrenadorSrv.buscarTodos().subscribe({
      next: (lista) => {
        const seen = new Set<number>();
        const activos = (lista ?? [])
          .filter((e: any) => e?.activo !== false)
          .map(
            (e: any) =>
              ({
                idEntrenador: Number(e?.idEntrenador ?? e?.id ?? 0),
                nombre: String(e?.nombre ?? ''),
                apellido: String(e?.apellido ?? ''),
                activo: e?.activo !== false,
                gimnasio: e?.gimnasio,
              }) as EntrenadorData,
          )
          .filter((e) => {
            if (!e.idEntrenador) return false;
            if (seen.has(e.idEntrenador)) return false;
            seen.add(e.idEntrenador);
            return true;
          });
        this.entrenadoresSig.set(activos);
        this.cargandoSig.set(false);
        this.entrenadoresCargados.emit(activos);
      },
      error: () => this.cargandoSig.set(false),
    });
  }

  onChange(value: string): void {
    const id = Number(value);
    this.entrenadorIdChange.emit(id > 0 ? id : null);
  }
}
