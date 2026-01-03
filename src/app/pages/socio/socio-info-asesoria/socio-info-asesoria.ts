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
    this.cargarHeaderSocio(); // 👈 carga confiable del encabezado
    this.cargar();            // 👈 datos de la tabla
  }

  /* =================== Header (nombre/teléfono) =================== */

  private setHeaderFromSocio(s: any): void {
    if (!s) return;
    const nombre = `${s?.nombre ?? ''} ${s?.apellido ?? ''}`.trim();
    this.socioNombre = nombre || (s?.idSocio ? `Socio ${s.idSocio}` : this.socioNombre);
    this.socioTelefono = s?.telefono ?? this.socioTelefono ?? null;
  }

  private cargarHeaderSocio(): void {
    // Llama al método real que tengas en SocioService para obtener por ID.
    // Probamos algunos nombres comunes para no romper tu build si tiene otro nombre:
    // obtenerPorId / getById / buscarPorId
    const req =
      (this.socioSrv as any).obtenerPorId?.(this.idSocio) ??
      (this.socioSrv as any).getById?.(this.idSocio) ??
      (this.socioSrv as any).buscarPorId?.(this.idSocio);

    if (req?.subscribe) {
      req.subscribe({
        next: (s: any) => this.setHeaderFromSocio(s),
        error: () => { /* silencioso; podemos caer al fallback desde la tabla */ }
      });
    }
  }

  /* =================== Rango X–Y de Z =================== */

  get rangoDesde(): number {
    if (this.totalElementos === 0) return 0;
    return this.pagina * this.tamanio + 1;
  }
  get rangoHasta(): number {
    const hasta = (this.pagina + 1) * this.tamanio;
    return Math.min(hasta, this.totalElementos);
  }

  /* =================== Cargar tabla =================== */

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

          // Si aún no tenemos header (p. ej. la llamada directa no respondió),
          // intenta con el socio embebido en el primer item.
          if (!this.socioNombre) {
            const s: any = this.asesorias[0]?.socio;
            if (s) this.setHeaderFromSocio(s);
          }

          // Si quedó vacía esta página y no es la primera, retrocede una
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

  /* =================== Paginación =================== */

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

  /* =================== Helpers UI =================== */

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
