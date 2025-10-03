// src/app/pages/historial/historial.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HistorialData } from '../../../model/historial-data';
import { HistorialService } from '../../../services/historial-service';
import { PagedResponse } from '../../../model/paged-response';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PagoData } from '../../../model/membresia-data';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './historial.html',
  styleUrl: './historial.css'
})
export class Historial implements OnInit {

  // Estado tabla
  cargando = true;
  mensajeError: string | null = null;
  lista: HistorialData[] = [];

  // Paginación
  paginaActual = 0;     // 0-based
  tamanioPagina = 10;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [5, 10, 20, 50];

  constructor(private srv: HistorialService) {}

  ngOnInit(): void {
    this.cargar();
  }

  // Helpers rango
  get rangoDesde(): number {
    if (this.totalElementos === 0) return 0;
    return this.paginaActual * this.tamanioPagina + 1;
  }
  get rangoHasta(): number {
    const hasta = (this.paginaActual + 1) * this.tamanioPagina;
    return Math.min(hasta, this.totalElementos);
  }

  // Carga
  private aplicar(resp: PagedResponse<HistorialData>): void {
    this.lista = resp.contenido ?? [];
    this.totalPaginas = resp.pagina?.totalPaginas ?? 0;
    this.totalElementos = resp.pagina?.totalElementos ?? 0;
    this.tamanioPagina = resp.pagina?.tamanio ?? this.tamanioPagina;
    this.paginaActual = resp.pagina?.numero ?? this.paginaActual;

    // si la página quedó vacía y no es la primera, retrocede y recarga
    if (this.lista.length === 0 && this.paginaActual > 0) {
      this.paginaActual--;
      this.cargar();
    }
  }

  cargar(): void {
    this.cargando = true;
    this.mensajeError = null;

    this.srv.consultar(this.paginaActual, this.tamanioPagina).subscribe({
      next: (resp) => { this.aplicar(resp); this.cargando = false; },
      error: (e) => {
        console.error(e);
        this.mensajeError = 'No se pudo cargar el historial.';
        this.cargando = false;
      }
    });
  }

  // Paginación
  cambiarTamanioPagina(nuevo: number | string): void {
    this.tamanioPagina = Number(nuevo);
    this.paginaActual = 0;
    this.cargar();
  }
  irPrimera(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual = 0;
    this.cargar();
  }
  irAnterior(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual--;
    this.cargar();
  }
  irSiguiente(): void {
    if (this.paginaActual + 1 >= this.totalPaginas) return;
    this.paginaActual++;
    this.cargar();
  }
  irUltima(): void {
    if (this.totalPaginas === 0) return;
    const ultima = this.totalPaginas - 1;
    if (this.paginaActual === ultima) return;
    this.paginaActual = ultima;
    this.cargar();
  }

  // ====== Helpers de pagos para la vista ======
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
}
