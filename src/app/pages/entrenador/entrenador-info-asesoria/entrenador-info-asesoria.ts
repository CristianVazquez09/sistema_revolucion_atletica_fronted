import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { AsesoriaContratoData } from 'src/app/model/asesoria-contrato-data';
import { PagoData } from 'src/app/model/membresia-data';
import { EntrenadorData } from 'src/app/model/entrenador-data';

import { EntrenadorService } from 'src/app/services/entrenador-service';

@Component({
  selector: 'app-entrenador-info-asesoria',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './entrenador-info-asesoria.html',
  styleUrl: './entrenador-info-asesoria.css'
})
export class EntrenadorInfoAsesoria implements OnInit {

  idEntrenador!: number;

  // header
  entrenadorNombre: string | null = null;
  entrenadorTelefono: string | null = null;

  // data
  private asesoriasAll: AsesoriaContratoData[] = []; // 👈 todas (sin paginar)
  asesorias: AsesoriaContratoData[] = [];            // 👈 página visible

  // UI
  cargando = true;
  error: string | null = null;

  // paginación (client-side)
  pagina = 0;          // 0-based
  tamanio = 10;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [5, 10, 20, 50];

  constructor(
    private route: ActivatedRoute,
    private entrenadorSrv: EntrenadorService
  ) {}

  ngOnInit(): void {
    this.idEntrenador = Number(this.route.snapshot.paramMap.get('idEntrenador'));
    this.cargarHeaderEntrenador();
    this.cargar();
  }

  /* =================== Header (nombre/teléfono) =================== */

  private setHeaderFromEntrenador(e: any): void {
    if (!e) return;
    const nombre = `${e?.nombre ?? ''} ${e?.apellido ?? ''}`.trim();
    this.entrenadorNombre =
      nombre || (e?.idEntrenador ? `Entrenador ${e.idEntrenador}` : this.entrenadorNombre);

    // OJO: si tu entrenador no tiene teléfono, esto quedará en '—' en el HTML
    this.entrenadorTelefono = e?.telefono ?? this.entrenadorTelefono ?? null;
  }

  private cargarHeaderEntrenador(): void {
    // Si tu GenericService expone getById/obtenerPorId, úsalo. Si no, no pasa nada.
    const req =
      (this.entrenadorSrv as any).obtenerPorId?.(this.idEntrenador) ??
      (this.entrenadorSrv as any).getById?.(this.idEntrenador) ??
      (this.entrenadorSrv as any).buscarPorId?.(this.idEntrenador);

    if (req?.subscribe) {
      req.subscribe({
        next: (e: EntrenadorData) => this.setHeaderFromEntrenador(e),
        error: () => { /* silencioso */ }
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

  /* =================== Cargar asesorías (NO paginado desde backend) =================== */

  cargar(): void {
    this.cargando = true;
    this.error = null;

    // ✅ Método real del service (regresa arreglo)
    this.entrenadorSrv.listarAsesoriasActivas(this.idEntrenador)
      .pipe(finalize(() => this.cargando = false))
      .subscribe({
        next: (data: AsesoriaContratoData[]) => {
          this.asesoriasAll = data ?? [];

          this.totalElementos = this.asesoriasAll.length;
          this.totalPaginas = this.tamanio > 0
            ? Math.ceil(this.totalElementos / this.tamanio)
            : 0;

          // Ajuste de página si queda fuera de rango
          if (this.totalPaginas === 0) {
            this.pagina = 0;
          } else if (this.pagina >= this.totalPaginas) {
            this.pagina = this.totalPaginas - 1;
          }

          // Fallback header desde data (si no pegó el endpoint getById)
          if (!this.entrenadorNombre) {
            const e: any = this.asesoriasAll[0]?.entrenador;
            if (e) this.setHeaderFromEntrenador(e);
          }

          this.aplicarPaginacion();
        },
        error: (err: unknown) => {
          console.error(err);
          this.error = 'No se pudieron cargar las asesorías del entrenador.';
        }
      });
  }

  private aplicarPaginacion(): void {
    const ini = this.pagina * this.tamanio;
    const fin = ini + this.tamanio;
    this.asesorias = this.asesoriasAll.slice(ini, fin);
  }

  /* =================== Paginación =================== */

  cambiarTamanioPagina(nuevo: number | string): void {
    this.tamanio = Number(nuevo);
    this.pagina = 0;

    this.totalPaginas = this.tamanio > 0
      ? Math.ceil(this.totalElementos / this.tamanio)
      : 0;

    this.aplicarPaginacion();
  }

  irPrimera(): void { if (this.pagina === 0) return; this.pagina = 0; this.aplicarPaginacion(); }
  irAnterior(): void { if (this.pagina === 0) return; this.pagina--; this.aplicarPaginacion(); }
  irSiguiente(): void { if (this.pagina + 1 >= this.totalPaginas) return; this.pagina++; this.aplicarPaginacion(); }
  irUltima(): void {
    if (this.totalPaginas === 0) return;
    if (this.pagina === this.totalPaginas - 1) return;
    this.pagina = this.totalPaginas - 1;
    this.aplicarPaginacion();
  }

  /* =================== Helpers UI =================== */

  esVigente(vigenteHasta?: string | null): boolean {
    if (!vigenteHasta) return false;
    const d = new Date(vigenteHasta);
    if (Number.isNaN(d.getTime())) return false;
    return d.getTime() > Date.now();
  }

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

  nombreSocio(a: AsesoriaContratoData): string {
    const s = a.socio as any;
    if (!s) return '—';
    const full = `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim();
    return full || (s.idSocio ? `Socio ${s.idSocio}` : '—');
  }

  telefonoSocio(a: AsesoriaContratoData): string {
    const s = a.socio as any;
    return s?.telefono || '—';
  }

  emailSocio(a: AsesoriaContratoData): string {
    const s = a.socio as any;
    return s?.email || '—';
  }
}
