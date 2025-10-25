import { Component, EventEmitter, Input, OnInit, Output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MembresiaService } from '../../../../services/membresia-service';
import { PaqueteService } from '../../../../services/paquete-service';
import { MembresiaData, PagoData } from '../../../../model/membresia-data';
import { MembresiaPatchRequest } from '../../../../model/membresia-patch';
import { PaqueteData } from '../../../../model/paquete-data';

@Component({
  selector: 'app-membresia-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './membresia-modal.html',
  styleUrl: './membresia-modal.css'
})
export class MembresiaModal implements OnInit {

  @Input() idMembresia!: number;
  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<MembresiaData>();

  private srv = inject(MembresiaService);
  private paqueteSrv = inject(PaqueteService);

  // base
  data: MembresiaData | null = null;
  cargando = true;
  guardando = false;
  error: string | null = null;

  // edición (signals)
  fechaInicio = signal<string>('');  // yyyy-MM-dd
  fechaFin    = signal<string>('');  // yyyy-MM-dd
  descuento   = signal<number>(0);

  // pagos
  efectivo = signal(0);
  tarjeta = signal(0);
  transferencia = signal(0);

  // cambio de paquete
  paqueteNuevoId: number | null = null;
  paqueteNuevo: PaqueteData | null = null; // si se carga, usamos sus precios

  // helpers
  protected readonly Math = Math;

  ngOnInit(): void {
    if (!this.idMembresia) { this.error = 'Falta idMembresia.'; this.cargando = false; return; }

    this.srv.buscarPorId(this.idMembresia).subscribe({
      next: (m) => {
        this.data = m;

        // fechas (normaliza a yyyy-MM-dd)
        this.fechaInicio.set(this.ymd(m.fechaInicio));
        this.fechaFin.set(this.ymd(m.fechaFin));

        // descuento
        this.descuento.set(Number(m.descuento || 0));

        // pagos (cargar tal cual)
        const sum = (tipo: string) => (m.pagos ?? [])
          .filter(p => p.tipoPago === tipo)
          .reduce((a, p) => a + Number(p.monto || 0), 0);
        this.efectivo.set(sum('EFECTIVO'));
        this.tarjeta.set(sum('TARJETA'));
        this.transferencia.set(sum('TRANSFERENCIA'));

        this.cargando = false;
      },
      error: () => { this.error = 'No se pudo cargar la membresía.'; this.cargando = false; }
    });
  }

  // ============== Cálculo local del total (vista) ==============

  private precioBaseVista = computed<number>(() => {
    if (!this.data) return 0;
    return Number(this.paqueteNuevo?.precio ?? this.data.paquete?.precio ?? 0);
  });

  /**
   * ⬅️ Importante:
   * Si la membresía es de REINSCRIPCION, NO cobramos costoInscripcion,
   * aun cuando se cambie de paquete dentro del modal.
   */
  private inscripcionVista = computed<number>(() => {
    if (!this.data) return 0;
    const esReinscripcion = String(this.data.movimiento) === 'REINSCRIPCION';
    if (esReinscripcion) return 0;

    return Number(this.paqueteNuevo?.costoInscripcion ?? this.data.paquete?.costoInscripcion ?? 0);
  });

  totalCalculadoVista = computed<number>(() => {
    return this.round2(this.precioBaseVista() + this.inscripcionVista() - Number(this.descuento() || 0));
  });

  sumaPagos = computed<number>(() => {
    return this.round2((this.efectivo() || 0) + (this.tarjeta() || 0) + (this.transferencia() || 0));
  });

  desbalance = computed<number>(() => this.round2(this.sumaPagos() - this.totalCalculadoVista()));

  unknownPaquete = computed<boolean>(() => {
    // bloquea si el usuario escribió un paqueteNuevoId y aún no lo pudimos cargar (o falló)
    if (this.paqueteNuevoId && !this.paqueteNuevo) return true;
    return false;
  });

  canSave = computed<boolean>(() =>
    !!this.data &&
    !this.cargando &&
    !this.guardando &&
    !this.unknownPaquete()
  );

  // ============== UI helpers ==============

  ajustarPagosAlTotal() {
    const total = this.totalCalculadoVista();
    this.efectivo.set(total);
    this.tarjeta.set(0);
    this.transferencia.set(0);
  }

  setPaqueteNuevoId(raw: number | null) {
    this.paqueteNuevoId = raw ?? null;
    this.paqueteNuevo = null;

    if (!this.paqueteNuevoId || this.paqueteNuevoId <= 0) return;

    this.paqueteSrv.buscarPorId(this.paqueteNuevoId).subscribe({
      next: (p) => { this.paqueteNuevo = p; },
      error: () => {
        this.paqueteNuevo = null;
        this.error = `No se encontró el paquete #${this.paqueteNuevoId}.`;
      }
    });
  }

  // ============== Guardar (arma PATCH como Ventas) ==============

  guardar(): void {
    if (!this.data?.idMembresia) return;

    // congelamos valores
    const yInicio = this.fechaInicio();
    const yFin    = this.fechaFin();
    const desc    = this.round2(this.descuento() || 0);

    // total vista ya considera que si es REINSCRIPCION no cobra costoInscripcion
    const totalVista = this.totalCalculadoVista();

    // pagos (ajustamos EFECTIVO si hace falta)
    let ef = this.round2(this.efectivo() || 0);
    let tj = selfRound2(this.tarjeta() || 0);
    let tr = selfRound2(this.transferencia() || 0);
    let suma = this.round2(ef + tj + tr);

    if (Math.abs(suma - totalVista) > 0.009) {
      const diff = this.round2(totalVista - suma);
      ef = this.round2(ef + diff);
      suma = this.round2(ef + tj + tr);
    }

    // acciones
    const acciones: MembresiaPatchRequest['acciones'] = [];

    // CAMBIAR_PAQUETE
    const idPaqueteActual = Number(this.data.paquete?.idPaquete ?? 0);
    if (this.paqueteNuevoId && this.paqueteNuevoId !== idPaqueteActual) {
      acciones.push({ op: 'CAMBIAR_PAQUETE', idPaqueteNuevo: Number(this.paqueteNuevoId) });
    }

    // CAMBIAR_DESCUENTO
    const descOrig = this.round2(Number(this.data.descuento || 0));
    if (this.round2(desc) !== descOrig) {
      acciones.push({ op: 'CAMBIAR_DESCUENTO', nuevoDescuento: desc });
    }

    // AJUSTAR_FECHAS
    const finOrig = this.ymd(this.data.fechaFin);
    const iniOrig = this.ymd(this.data.fechaInicio);
    if (yInicio !== iniOrig || yFin !== finOrig) {
      acciones.push({ op: 'AJUSTAR_FECHAS', nuevaFechaInicio: yInicio, nuevaFechaFin: yFin });
    }

    // REEMPLAZAR_PAGOS
    const pagos: PagoData[] = [];
    if (ef > 0) pagos.push({ tipoPago: 'EFECTIVO' as any, monto: ef });
    if (tj > 0) pagos.push({ tipoPago: 'TARJETA'  as any, monto: tj });
    if (tr > 0) pagos.push({ tipoPago: 'TRANSFERENCIA' as any, monto: tr });
    acciones.push({ op: 'REEMPLAZAR_PAGOS', pagos });

    // si no hay cambios… igual mandamos REEMPLAZAR_PAGOS (idempotente)
    const body: MembresiaPatchRequest = { acciones };

    this.guardando = true;
    this.srv.patch(this.data.idMembresia, body).subscribe({
      next: (actualizada) => {
        this.guardando = false;
        this.data = actualizada;

        // re-sincroniza estado visual con respuesta real
        this.fechaInicio.set(this.ymd(actualizada.fechaInicio));
        this.fechaFin.set(this.ymd(actualizada.fechaFin));
        this.descuento.set(Number(actualizada.descuento || 0));

        const sum = (tipo: string) => (actualizada.pagos ?? [])
          .filter(p => p.tipoPago === tipo)
          .reduce((a, p) => a + Number(p.monto || 0), 0);
        this.efectivo.set(sum('EFECTIVO'));
        this.tarjeta.set(sum('TARJETA'));
        this.transferencia.set(sum('TRANSFERENCIA'));

        this.paqueteNuevoId = null;
        this.paqueteNuevo = null;

        this.guardado.emit(actualizada);
      },
      error: (err) => {
        this.guardando = false;
        this.error = err?.error?.detail || 'No se pudo guardar los cambios.';
      }
    });
  }

  // ============== utils ==============

  private ymd(s?: string | null): string {
    if (!s) return '';
    // soporta "2025-10-18" o "2025-10-18T09:30:00"
    const i = s.indexOf('T');
    return (i >= 0 ? s.slice(0, i) : s).trim();
  }
  private round2(n: number): number { return Math.round((Number(n)||0) * 100) / 100; }
}

// helper local para no “this.” en una línea
function selfRound2(n: number): number {
  return Math.round((Number(n)||0) * 100) / 100;
}
