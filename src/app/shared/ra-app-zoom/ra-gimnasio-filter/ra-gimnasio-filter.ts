import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, Input, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GimnasioService } from 'src/app/services/gimnasio-service';
import { TenantContextService } from 'src/app/core/tenant-context.service';
import { GimnasioData } from 'src/app/model/gimnasio-data';

@Component({
  selector: 'ra-gimnasio-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isAdmin()) {
      <div class="flex items-center gap-2">
        <span class="text-[11px] xl:text-[12px] text-ra-slate/80 whitespace-nowrap">{{ label }}</span>

        <select
          class="h-8 xl:h-9 rounded-lg xl:rounded-xl border border-gray-200 bg-gray-100 px-2.5 xl:px-3 py-1.5 xl:py-2 shadow-inner text-[11px] xl:text-[12px]"
          [(ngModel)]="selectedId"
          (ngModelChange)="onChange($event)"
        >
          <option [ngValue]="null">Todos</option>
          <option *ngFor="let g of gimnasios()" [ngValue]="g.idGimnasio">
            {{ g.nombre }}
          </option>
        </select>
      </div>
    }
  `,
})
export class RaGimnasioFilterComponent implements OnInit {
  @Input() label = 'Gimnasio';

  private gymSrv = inject(GimnasioService);
  private tenant = inject(TenantContextService);
  private destroyRef = inject(DestroyRef);

  gimnasios = signal<GimnasioData[]>([]);
  selectedId: number | null = null;

  isAdmin = signal(false);

  ngOnInit(): void {
    // ✅ estado inicial + reactivo
    this.isAdmin.set(this.tenant.isAdmin);

    this.tenant.isAdminChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.isAdmin.set(!!v));

    if (!this.tenant.isAdmin) return;

    this.selectedId = this.tenant.viewTenantId;

    this.gymSrv.buscarTodos().subscribe({
      next: (lista: any[]) => {
        const vistos = new Set<number>();
        const mapped = (lista ?? [])
          .map((g: any) => ({
            idGimnasio: typeof g.idGimnasio === 'number' ? g.idGimnasio : Number(g.id),
            nombre: g.nombre,
            direccion: g.direccion,
            telefono: g.telefono,
          } as GimnasioData))
          .filter(g => {
            if (!g.idGimnasio) return false;
            if (vistos.has(g.idGimnasio)) return false;
            vistos.add(g.idGimnasio);
            return true;
          });

        this.gimnasios.set(mapped);
      },
      error: () => this.gimnasios.set([]),
    });
  }

  onChange(v: any) {
    const id = (v === '' || v == null) ? null : Number(v);
    this.selectedId = Number.isFinite(id as any) ? (id as number) : null;

    // ✅ lo que “ve” el admin
    this.tenant.setViewTenant(this.selectedId);
  }
}
