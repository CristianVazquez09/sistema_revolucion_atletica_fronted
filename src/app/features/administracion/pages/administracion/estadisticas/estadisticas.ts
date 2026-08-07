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
import * as echarts from 'echarts';
import type { ECharts } from 'echarts';

import {
  EstadisticasService,
  DashboardResponse,
} from '../../../data/estadisticas-service';
import { ReportesService } from '../../../data/reportes-service';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './estadisticas.html',
  styleUrls: ['./estadisticas.scss'],
})
export class Estadisticas implements OnInit, OnDestroy {
  private estadisticasSrv = inject(EstadisticasService);
  private reportesSrv     = inject(ReportesService);
  private jwt             = inject(JwtHelperService);
  private fb              = inject(FormBuilder);

  isAdmin  = false;
  gimnasios: any[] = [];
  cargando = false;
  error: string | null = null;
  datos: DashboardResponse | null = null;

  @ViewChild('revCanvas')    revCanvas?:    ElementRef<HTMLDivElement>;
  @ViewChild('ageCanvas')    ageCanvas?:    ElementRef<HTMLDivElement>;
  @ViewChild('genderCanvas') genderCanvas?: ElementRef<HTMLDivElement>;
  @ViewChild('attendCanvas') attendCanvas?: ElementRef<HTMLDivElement>;
  @ViewChild('sparkCanvas')  sparkCanvas?:  ElementRef<HTMLDivElement>;

  private charts: ECharts[] = [];

  private readonly hoy          = new Date();
  private readonly primerDiaMes = new Date(this.hoy.getFullYear(), this.hoy.getMonth(), 1);

  form = this.fb.nonNullable.group({
    idGimnasio: [null as number | null],
    desde: [this.fechaLocal(this.primerDiaMes)],
    hasta: [this.fechaLocal(this.hoy)],
  });

  ngOnInit(): void {
    this.isAdmin = this.esAdmin();
    if (this.isAdmin) {
      this.cargarGimnasios();
    } else {
      this.consultar();
    }
  }

  ngOnDestroy(): void {
    this.destruirCharts();
  }

  consultar(): void {
    this.error   = null;
    this.cargando = true;
    const { idGimnasio, desde, hasta } = this.form.getRawValue();
    const gymParam = this.isAdmin ? idGimnasio : null;

    this.estadisticasSrv.getDashboard(gymParam, desde, hasta).subscribe({
      next: (data) => {
        this.datos    = data;
        this.cargando = false;
        setTimeout(() => this.renderizarGraficos(), 50);
      },
      error: (e) => {
        this.error    = e?.error?.message ?? e?.error?.detail ?? 'No se pudo cargar el dashboard. Verifica las fechas.';
        this.cargando = false;
      },
    });
  }

  // ─── Helpers de template ────────────────────────────────────────────
  money(n?: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n ?? 0);
  }

  gymId(g: any): number | null    { return g?.idGimnasio ?? g?.id ?? null; }
  displayGym(g: any): string      { return g?.nombre?.trim() || (this.gymId(g) != null ? `#${this.gymId(g)}` : '—'); }
  pct(parte: number, total: number): string { return total ? `${Math.round((parte / total) * 100)}%` : '0%'; }

  tipoPct(cantidad: number): number {
    const tipos = this.datos?.membresias.activasPorTipoPaquete ?? [];
    const max   = Math.max(...tipos.map(t => t.cantidad), 1);
    return Math.round((cantidad / max) * 100);
  }

  initials(nombre: string, apellido: string): string {
    return ((nombre?.[0] ?? '') + (apellido?.[0] ?? '')).toUpperCase();
  }

  periodoLabel(): string {
    try {
      const { desde, hasta } = this.form.getRawValue();
      const fmt = (s: string) =>
        new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
          .format(new Date(s + 'T12:00:00'));
      return `${fmt(desde)} – ${fmt(hasta)}`;
    } catch { return ''; }
  }

  // ─── Privados ────────────────────────────────────────────────────────
  private fechaLocal(d: Date): string {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private esAdmin(): boolean {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) return false;
    try {
      const decoded: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(decoded?.roles)       ? decoded.roles       : []),
        ...(Array.isArray(decoded?.authorities) ? decoded.authorities : []),
      ].map(r => String(r).toUpperCase());
      return decoded?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch { return false; }
  }

  private cargarGimnasios(): void {
    this.reportesSrv.listarGimnasios().subscribe({
      next: (data) => {
        this.gimnasios = data ?? [];
        const idToken  = this.gymIdDesdeToken();
        const match    = this.gimnasios.find(g => this.gymId(g) === idToken);
        const autoGym  = match ?? this.gimnasios[0] ?? null;
        if (autoGym) this.form.controls.idGimnasio.setValue(this.gymId(autoGym));
        this.consultar();
      },
      error: () => this.consultar(),
    });
  }

  private gymIdDesdeToken(): number | null {
    try {
      const raw     = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
      const decoded: any = this.jwt.decodeToken(raw);
      const id      = decoded?.idGimnasio ?? decoded?.gymId ?? decoded?.gym_id ?? decoded?.gym?.id ?? null;
      return id != null ? Number(id) : null;
    } catch { return null; }
  }

  private destruirCharts(): void {
    this.charts.forEach(c => { try { c.dispose(); } catch { /**/ } });
    this.charts = [];
  }

  private renderizarGraficos(): void {
    this.destruirCharts();
    if (!this.datos) return;
    this.chartIngresos();
    this.chartEdad();
    this.chartGenero();
    this.chartAsistencias();
    this.chartSpark();
  }

  private mk(el?: ElementRef<HTMLDivElement>): ECharts | null {
    if (!el?.nativeElement) return null;
    try {
      const ex = echarts.getInstanceByDom(el.nativeElement);
      if (ex) ex.dispose();
      return echarts.init(el.nativeElement);
    } catch { return null; }
  }

  private readonly axisLabel = { color: '#9AA0B2', fontSize: 11, fontFamily: 'Manrope' };
  private readonly gridBase  = { left: 52, right: 16, top: 12, bottom: 28 };
  private readonly tooltip   = (extra?: object) => ({
    trigger: 'axis' as const,
    backgroundColor: '#14161C',
    borderWidth: 0,
    textStyle: { color: '#fff', fontFamily: 'Manrope', fontSize: 12 },
    ...extra,
  });

  private chartIngresos(): void {
    const c = this.mk(this.revCanvas);
    if (!c) return;

    const raw2 = (this.datos!.financieras ?? {}) as any;
    const dias: any[] = raw2.ingresosPorDia ?? raw2.ingresosDiarios ?? raw2.porDia ?? raw2.dias ?? [];
    const labels = dias.map((d: any) => this.diaLabel(d.fecha ?? d.dia ?? d.date ?? ''));

    c.setOption({
      grid: this.gridBase,
      tooltip: this.tooltip({ valueFormatter: (v: unknown) => this.money(Number(v)) }),
      xAxis: {
        type: 'category', data: labels, boundaryGap: false,
        axisLine: { lineStyle: { color: '#EBECF1' } },
        axisTick: { show: false },
        axisLabel: { ...this.axisLabel, interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F2F6' } },
        axisLabel: { ...this.axisLabel, formatter: (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}` },
      },
      series: [
        {
          name: 'Total', type: 'line', smooth: true,
          data: dias.map((d: any) => d.total ?? d.ingresoTotal ?? 0),
          symbol: 'none', lineStyle: { width: 3, color: '#E8502E' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(232,80,46,.22)' }, { offset: 1, color: 'rgba(232,80,46,0)' }],
            },
          },
          z: 4,
        },
        { name: 'Membresías', type: 'line', smooth: true, data: dias.map((d: any) => d.membresias ?? 0), symbol: 'none', lineStyle: { width: 2, color: '#2E6BE6' } },
        { name: 'Ventas',     type: 'line', smooth: true, data: dias.map((d: any) => d.ventas     ?? 0), symbol: 'none', lineStyle: { width: 2, color: '#14B8A6' } },
        { name: 'Asesorías',  type: 'line', smooth: true, data: dias.map((d: any) => d.asesorias  ?? 0), symbol: 'none', lineStyle: { width: 2, color: '#7A4FE0' } },
      ],
    });
    this.charts.push(c);
  }

  private chartEdad(): void {
    const c = this.mk(this.ageCanvas);
    if (!c) return;

    const dist = (this.datos!.socios.distribucionEdades ?? []).slice().sort((a, b) => a.edad - b.edad);
    if (!dist.length) return;

    c.setOption({
      grid: { left: 34, right: 12, top: 14, bottom: 26 },
      tooltip: this.tooltip(),
      xAxis: {
        type: 'category', data: dist.map(d => `${d.edad}`),
        axisLine: { lineStyle: { color: '#EBECF1' } },
        axisTick: { show: false },
        axisLabel: { ...this.axisLabel, interval: 4 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F2F6' } },
        axisLabel: this.axisLabel,
      },
      series: [{
        type: 'bar', data: dist.map(d => d.cantidad),
        itemStyle: { color: '#8B7BF0', borderRadius: [3, 3, 0, 0] as any },
        barWidth: '62%',
      }],
    });
    this.charts.push(c);
  }

  private chartGenero(): void {
    const c = this.mk(this.genderCanvas);
    if (!c) return;

    const g = this.datos!.socios.porGenero;
    c.setOption({
      tooltip: { trigger: 'item', backgroundColor: '#14161C', borderWidth: 0, textStyle: { color: '#fff', fontFamily: 'Manrope', fontSize: 12 } },
      series: [{
        type: 'pie', radius: ['62%', '86%'], center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false }, labelLine: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 3 },
        data: [
          { value: g.masculino, name: 'Masculino', itemStyle: { color: '#2E6BE6' } },
          { value: g.femenino,  name: 'Femenino',  itemStyle: { color: '#EC4899' } },
        ],
      }],
    });
    this.charts.push(c);
  }

  private chartAsistencias(): void {
    const c = this.mk(this.attendCanvas);
    if (!c) return;

    const raw  = (this.datos!.asistencias ?? {}) as any;
    const dias: any[] = raw.asistenciasPorDia ?? raw.asistenciasDiarias ?? raw.porDia ?? raw.dias ?? raw.data ?? [];

    if (!dias.length) {
      c.setOption({ graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: 'Sin datos de asistencias', fill: '#9AA0B2', fontSize: 13, fontFamily: 'Manrope' } }] });
      this.charts.push(c);
      return;
    }

    c.setOption({
      grid: { left: 40, right: 12, top: 14, bottom: 26 },
      tooltip: this.tooltip(),
      xAxis: {
        type: 'category', data: dias.map((d: any) => this.diaLabel(d.fecha ?? d.dia ?? d.date ?? '')),
        axisLine: { lineStyle: { color: '#EBECF1' } },
        axisTick: { show: false },
        axisLabel: { ...this.axisLabel, interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#F1F2F6' } },
        axisLabel: this.axisLabel,
      },
      series: [{
        type: 'bar', data: dias.map((d: any) => d.cantidad ?? d.total ?? d.asistencias ?? 0),
        itemStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#F58a3c' }, { offset: 1, color: '#E8502E' }] } as any,
          borderRadius: [5, 5, 0, 0] as any,
        },
        barWidth: '52%',
      }],
    });
    this.charts.push(c);
  }

  private chartSpark(): void {
    const c = this.mk(this.sparkCanvas);
    if (!c) return;

    const fin  = (this.datos!.financieras ?? {}) as any;
    const dias = fin.ingresosPorDia ?? fin.ingresosDiarios ?? fin.porDia ?? [];
    c.setOption({
      grid: { left: 0, right: 0, top: 6, bottom: 0 },
      xAxis: { type: 'category', show: false, data: dias.map((_: any, i: number) => i) },
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'line', data: dias.map((d: any) => d.total ?? d.ingresoTotal ?? 0), smooth: true, symbol: 'none',
        lineStyle: { width: 2, color: 'rgba(255,255,255,.85)' },
        areaStyle: { color: 'rgba(255,255,255,.16)' },
      }],
    });
    this.charts.push(c);
  }

  private diaLabel(fecha: string): string {
    try {
      return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' })
        .format(new Date(fecha + 'T12:00:00'));
    } catch { return fecha; }
  }
}
