// src/app/pages/socio/socio-info-asesoria/socio-info-asesoria.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { SocioService } from '../../../services/socio-service';
import { PagedResponse } from '../../../model/paged-response';
import { AsesoriaContratoData } from '../../../model/asesoria-contrato-data';
import { PagoData } from '../../../model/membresia-data';

@Component({
  selector: 'app-socio-info-asesoria',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './socio-info-asesoria.html',
  styleUrl: './socio-info-asesoria.css'
})
export class SocioInfoAsesoria implements OnInit {

  idSocio!: number;

  // encabezado
  socioNombre: string | null = null;
  socioTelefono: string | null = null;

  // data
  asesorias: AsesoriaContratoData[] = [];

  // UI
  cargando = true;
  error: string | null = null;

  // paginación
  pagina = 0;          // 0-based
  tamanio = 10;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [5, 10, 20, 50];

  constructor(private route: ActivatedRoute, private socioSrv: SocioService) {}

  ngOnInit(): void {
    this.idSocio = Number(this.route.snapshot.paramMap.get('idSocio'));
    this.cargar();
  }

  get rangoDesde(): number {
    if (this.totalElementos === 0) return 0;
    return this.pagina * this.tamanio + 1;
  }
  get rangoHasta(): number {
    const hasta = (this.pagina + 1) * this.tamanio;
    return Math.min(hasta, this.totalElementos);
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;

    this.socioSrv.obtenerAsesoriasDeSocio(this.idSocio, this.pagina, this.tamanio)
      .pipe(finalize(() => this.cargando = false))
      .subscribe({
        next: (resp: PagedResponse<AsesoriaContratoData>) => {
          this.asesorias = resp.contenido ?? [];
          this.totalPaginas = resp.pagina?.totalPaginas ?? 0;
          this.totalElementos = resp.pagina?.totalElementos ?? 0;
          this.tamanio = resp.pagina?.tamanio ?? this.tamanio;
          this.pagina = resp.pagina?.numero ?? this.pagina;

          // encabezado desde el primer item (si lo trae)
          const s: any = this.asesorias[0]?.socio;
          this.socioNombre = s ? `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim() || null : null;
          this.socioTelefono = s?.telefono ?? null;

          if (this.asesorias.length === 0 && this.pagina > 0) {
            this.pagina = this.pagina - 1;
            this.cargar();
          }
        },
        error: (err: unknown) => {
          console.error(err);
          this.error = 'No se pudieron cargar las asesorías.';
        }
      });
  }

  // paginación
  cambiarTamanioPagina(nuevo: number | string): void {
    this.tamanio = Number(nuevo);
    this.pagina = 0;
    this.cargar();
  }
  irPrimera(): void { if (this.pagina === 0) return; this.pagina = 0; this.cargar(); }
  irAnterior(): void { if (this.pagina === 0) return; this.pagina--; this.cargar(); }
  irSiguiente(): void { if (this.pagina + 1 >= this.totalPaginas) return; this.pagina++; this.cargar(); }
  irUltima(): void {
    if (this.totalPaginas === 0) return;
    if (this.pagina === this.totalPaginas - 1) return;
    this.pagina = this.totalPaginas - 1;
    this.cargar();
  }

  // helpers UI
  labelTiempo(t: string | null | undefined): string {
    return String(t ?? '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  pagosConMonto(pagos?: PagoData[] | null): PagoData[] {
    return (pagos ?? []).filter(p => Number(p?.monto) > 0);
  }
  labelPago(tipo: PagoData['tipoPago'] | string): string {
    switch (tipo) {
      case 'EFECTIVO': return 'Efectivo';
      case 'TARJETA': return 'Tarjeta';
      case 'TRANSFERENCIA': return 'Transferencia';
      default: return String(tipo);
    }
  }
  nombreEntrenador(a: AsesoriaContratoData): string {
    const e = a.entrenador;
    if (!e) return '—';
    const full = `${e.nombre ?? ''} ${e.apellido ?? ''}`.trim();
    return full || `#${e.idEntrenador}`;
  }
  nombreGimnasio(a: AsesoriaContratoData): string {
    const g = a.gimnasio;
    if (!g) return '—';
    return g.nombre ?? (g as any).id ?? '—';
  }
}
