import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { VentaService } from '../../../../services/venta-service';
import { VentaData } from '../../../../model/venta-data';

@Component({
  selector: 'app-ventas-admin-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ventas-admin-modal.html',
  styleUrl: './ventas-admin-modal.css'
})
export class VentasAdminModal implements OnInit {
  @Input() idVenta!: number;
  @Output() cancelar = new EventEmitter<void>();

  private srv = inject(VentaService);

  data: VentaData | null = null;
  cargando = true;
  error: string | null = null;

  ngOnInit(): void {
    if (this.idVenta == null) {
      this.error = 'Falta idVenta.';
      this.cargando = false;
      return;
    }
    this.srv.buscarPorId(this.idVenta).subscribe({
      next: (v) => { this.data = v; this.cargando = false; },
      error: ()   => { this.error = 'No se pudo cargar la venta.'; this.cargando = false; }
    });
  }

  pagosChip(v: VentaData): string {
    const tot = (tipo: string) =>
      (v.pagos ?? []).filter(p => p.tipoPago === tipo).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);
    const chips: string[] = [];
    const e = tot('EFECTIVO'); if (e > 0) chips.push(`Efectivo ${fmt(e)}`);
    const t = tot('TARJETA');  if (t > 0) chips.push(`Tarjeta ${fmt(t)}`);
    const tr= tot('TRANSFERENCIA'); if (tr > 0) chips.push(`Transf. ${fmt(tr)}`);
    return chips.join(' · ') || '—';
  }
}
