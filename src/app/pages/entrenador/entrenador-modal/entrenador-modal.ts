// src/app/pages/entrenador/entrenador-modal.ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EntrenadorData } from 'src/app/model/entrenador-data';
import { AsesoriaContratoData } from 'src/app/model/asesoria-contrato-data';
import { PagoData } from 'src/app/model/membresia-data';

@Component({
  selector: 'app-entrenador-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './entrenador-modal.html',
  styleUrl: './entrenador-modal.css'
})
export class EntrenadorModal {

  @Input() entrenador!: EntrenadorData;
  @Input() asesorias: AsesoriaContratoData[] = [];
  @Input() cargando = false;
  @Input() error: string | null = null;

  @Output() cerrar = new EventEmitter<void>();

  onCerrar(): void {
    this.cerrar.emit();
  }

  /* ===== Helpers similares a SocioInfoAsesoria ===== */

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
    const s = a.socio;
    if (!s) return '—';
    const full = `${s.nombre ?? ''} ${s.apellido ?? ''}`.trim();
    return full || (s.idSocio ? `Socio ${s.idSocio}` : '—');
  }

  telefonoSocio(a: AsesoriaContratoData): string {
    const s = a.socio;
    return s?.telefono || '—';
  }

  emailSocio(a: AsesoriaContratoData): string {
    const s = a.socio;
    return s?.email || '—';
  }
}
