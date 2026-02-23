// src/app/pages/administracion/estadisticas/estadisticas.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { JwtHelperService } from '@auth0/angular-jwt';
import Chart from 'chart.js/auto';

import {
  EstadisticasService,
  DashboardResponse,
} from '../../../services/estadisticas-service';
import { ReportesService } from '../../../services/reportes-service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './estadisticas.html',
})
export class Estadisticas implements OnInit, OnDestroy {
  private estadisticasSrv = inject(EstadisticasService);
  private reportesSrv = inject(ReportesService);
  private jwt = inject(JwtHelperService);
  private fb = inject(FormBuilder);

  isAdmin = false;
  gimnasios: any[] = [];
  cargando = false;
  error: string | null = null;
  datos: DashboardResponse | null = null;

  // ViewChild refs a los canvas (sólo disponibles cuando datos != null)
  @ViewChild('ingresosCanvas') ingresosCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('asistenciasCanvas') asistenciasCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('generoCanvas') generoCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('edadCanvas') edadCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('membresiasCanvas') membresiasCanvas?: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  // Defaults: primer día del mes actual → hoy
  private readonly hoy = new Date();
  private readonly primerDiaMes = new Date(
    this.hoy.getFullYear(),
    this.hoy.getMonth(),
    1
  );

  form = this.fb.nonNullable.group({
    idGimnasio: [null as number | null],
    desde: [this.fechaLocal(this.primerDiaMes)],
    hasta: [this.fechaLocal(this.hoy)],
  });

  ngOnInit(): void {
    this.isAdmin = this.esAdmin();
    if (this.isAdmin) {
      // Admin: cargar gyms → auto-seleccionar → consultar
      this.cargarGimnasios();
    } else {
      // No admin: backend usa el tenant del token
      this.consultar();
    }
  }

  ngOnDestroy(): void {
    this.destruirCharts();
  }

  consultar(): void {
    this.error = null;
    this.cargando = true;
    const { idGimnasio, desde, hasta } = this.form.getRawValue();

    // Admin requiere idGimnasio; no-admin: el backend usa tenant del token (null = no enviar param)
    const gymParam = this.isAdmin ? idGimnasio : null;

    this.estadisticasSrv
      .getDashboard(gymParam, desde, hasta)
      .subscribe({
        next: (data) => {
          this.datos = data;
          this.cargando = false;
          // 50ms para dar tiempo a Angular de renderizar el @if(datos)
          setTimeout(() => this.renderizarGraficos(), 50);
        },
        error: (e) => {
          this.error =
            e?.error?.message ??
            e?.error?.detail ??
            'No se pudo cargar el dashboard. Verifica las fechas.';
          this.cargando = false;
        },
      });
  }

  // ─── Helpers de template ────────────────────────────────────────────
  money(n?: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n ?? 0);
  }

  gymId(g: any): number | null {
    return g?.idGimnasio ?? g?.id ?? null;
  }

  displayGym(g: any): string {
    return g?.nombre?.trim() || (this.gymId(g) != null ? `#${this.gymId(g)}` : '—');
  }

  pct(parte: number, total: number): string {
    if (!total) return '0%';
    return `${Math.round((parte / total) * 100)}%`;
  }

  // ─── Privados ────────────────────────────────────────────────────────
  private fechaLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private esAdmin(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles) ? decoded.roles : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
      ].map((r) => String(r).toUpperCase());
      return (
        decoded?.is_admin === true ||
        roles.includes('ADMIN') ||
        roles.includes('ROLE_ADMIN')
      );
    } catch {
      return false;
    }
  }

  private cargarGimnasios(): void {
    this.reportesSrv.listarGimnasios().subscribe({
      next: (data) => {
        this.gimnasios = data ?? [];

        // Auto-seleccionar: primero intentar el gym del token, luego el primero de la lista
        const idToken = this.gymIdDesdeToken();
        const match = this.gimnasios.find((g) => this.gymId(g) === idToken);
        const autoGym = match ?? this.gimnasios[0] ?? null;

        if (autoGym) {
          this.form.controls.idGimnasio.setValue(this.gymId(autoGym));
        }

        this.consultar();
      },
      error: () => {
        // Si falla la carga de gyms, igual intentar consultar
        this.consultar();
      },
    });
  }

  private gymIdDesdeToken(): number | null {
    try {
      const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
      const decoded: any = this.jwt.decodeToken(raw);
      const id =
        decoded?.idGimnasio ??
        decoded?.gymId ??
        decoded?.gym_id ??
        decoded?.gym?.id ??
        null;
      return id != null ? Number(id) : null;
    } catch {
      return null;
    }
  }

  private destruirCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private renderizarGraficos(): void {
    this.destruirCharts();
    if (!this.datos) return;

    this.chartIngresos();
    this.chartAsistencias();
    this.chartGenero();
    this.chartEdad();
    this.chartMembresias();
  }

  // ─── Gráficos individuales ───────────────────────────────────────────

  // Extrae un número de un objeto intentando varios nombres de campo posibles
  private pick(obj: any, ...keys: string[]): number {
    for (const k of keys) {
      const v = obj?.[k];
      if (v != null && Number.isFinite(Number(v))) return Number(v);
    }
    return 0;
  }

  private chartIngresos(): void {
    const canvas = this.ingresosCanvas?.nativeElement;
    if (!canvas) return;

    const raw = (this.datos!.financieras as any);
    const dias: any[] = raw.ingresosPorDia ?? raw.ingresosDiarios ?? raw.porDia ?? [];

    const labels = dias.map((d: any) =>
      this.diaLabel(d.dia ?? d.fecha ?? d.date ?? '')
    );

    const c = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total',
            data: dias.map((d: any) => this.pick(d, 'total', 'ingresoTotal')),
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245,158,11,0.12)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2.5,
          },
          {
            label: 'Membresías',
            data: dias.map((d: any) => this.pick(d, 'membresias')),
            borderColor: '#3B82F6',
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 2,
            borderWidth: 1.5,
          },
          {
            label: 'Ventas',
            data: dias.map((d: any) => this.pick(d, 'ventas')),
            borderColor: '#10B981',
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 2,
            borderWidth: 1.5,
          },
          {
            label: 'Asesorías',
            data: dias.map((d: any) => this.pick(d, 'asesorias')),
            borderColor: '#8B5CF6',
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 2,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 }, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                ` ${ctx.dataset.label}: ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(Number(ctx.raw))}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) =>
                `$${new Intl.NumberFormat('es-MX').format(Number(v))}`,
              font: { size: 10 },
            },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          x: {
            ticks: { font: { size: 9 }, maxRotation: 45 },
            grid: { display: false },
          },
        },
      },
    });
    this.charts.push(c);
  }

  private chartAsistencias(): void {
    const canvas = this.asistenciasCanvas?.nativeElement;
    if (!canvas) return;
    const raw = (this.datos!.asistencias as any);
    const dias: any[] = raw.asistenciasPorDia ?? raw.asistenciasDiarias ?? raw.porDia ?? [];

    const c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dias.map((d: any) => this.diaLabel(d.dia ?? d.fecha ?? d.date ?? '')),
        datasets: [
          {
            label: 'Check-ins',
            data: dias.map((d: any) =>
              this.pick(d, 'cantidad', 'total', 'asistencias', 'checkIns', 'count')),
            backgroundColor: 'rgba(245,158,11,0.85)',
            borderColor: '#D97706',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          x: {
            ticks: { font: { size: 9 }, maxRotation: 45 },
            grid: { display: false },
          },
        },
      },
    });
    this.charts.push(c);
  }

  private chartGenero(): void {
    const canvas = this.generoCanvas?.nativeElement;
    if (!canvas) return;
    const g = this.datos!.socios.porGenero;

    const c = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Masculino', 'Femenino'],
        datasets: [
          {
            data: [g.masculino, g.femenino],
            backgroundColor: ['#3B82F6', '#F43F5E'],
            borderWidth: 3,
            borderColor: '#ffffff',
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 11, font: { size: 11 }, padding: 10 },
          },
        },
      },
    });
    this.charts.push(c);
  }

  private chartEdad(): void {
    const canvas = this.edadCanvas?.nativeElement;
    if (!canvas) return;
    const e = this.datos!.socios.porEdad;

    const c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['< 30 años', '30–59 años', '≥ 60 años'],
        datasets: [
          {
            data: [e.jovenes, e.adultos, e.terceraEdad],
            backgroundColor: ['#6366F1', '#10B981', '#F97316'],
            borderRadius: 5,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          x: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
    });
    this.charts.push(c);
  }

  private chartMembresias(): void {
    const canvas = this.membresiasCanvas?.nativeElement;
    if (!canvas) return;
    const tipos = this.datos!.membresias.activasPorTipoPaquete ?? [];
    const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#F43F5E', '#F97316', '#06B6D4'];

    const c = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: tipos.map((t) => t.tipoPaquete),
        datasets: [
          {
            data: tipos.map((t) => t.cantidad),
            backgroundColor: tipos.map((_, i) => COLORS[i % COLORS.length]),
            borderRadius: 5,
            borderWidth: 0,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
          },
          y: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
    });
    this.charts.push(c);
  }

  private diaLabel(fecha: string): string {
    try {
      const d = new Date(fecha + 'T12:00:00');
      return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
      }).format(d);
    } catch {
      return fecha;
    }
  }
}
