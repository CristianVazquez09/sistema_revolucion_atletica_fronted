import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize, of, switchMap } from 'rxjs';

import { EntrenadorService } from '../../services/entrenador-service';
import { SocioService } from '../../services/socio-service';
import { GimnasioService } from '../../services/gimnasio-service';

import { EntrenadorData } from '../../model/entrenador-data';
import { SocioData } from '../../model/socio-data';
import { GimnasioData } from '../../model/gimnasio-data';
import { TiempoPlan } from '../../util/enums/tiempo-plan';
import { PagoData } from '../../model/membresia-data';

import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import { NotificacionService } from '../../services/notificacion-service';
import { TicketService, VentaContexto } from '../../services/ticket-service';
import { ResumenVenta } from '../resumen-venta/resumen-venta';
import { crearContextoTicket } from '../../util/ticket-contexto';
import { AsesoriaCreateRequest } from '../../model/asesoria-data';
import { TiempoPlanLabelPipe } from '../../util/tiempo-plan-label';
import { AsesoriaService } from '../../services/asesoria-service';

@Component({
  selector: 'app-asesoria',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ResumenVenta, TiempoPlanLabelPipe],
  templateUrl: './asesoria.html',
  styleUrls: ['./asesoria.css'],
})
export class Asesoria implements OnInit {
  // Servicios
  private asesoriaSrv   = inject(AsesoriaService);
  private entrenadorSrv  = inject(EntrenadorService);
  private socioSrv       = inject(SocioService);
  private gymSrv         = inject(GimnasioService);
  private jwt            = inject(JwtHelperService);
  private noti           = inject(NotificacionService);
  private ticket         = inject(TicketService);

  // Contexto / estado
  isAdmin = false;
  gym: GimnasioData | null = null;
  cajero = 'Cajero';
  fechaResumen: Date = new Date();

  // Catálogos
  gimnasios: GimnasioData[] = [];
  cargandoGimnasios = false;

  entrenadores: EntrenadorData[] = [];
  entrenadoresFiltrados: EntrenadorData[] = [];
  cargandoEntrenadores = true;

  // Socio
  socio: SocioData | null = null;
  cargandoSocio = false;

  // TiempoPlan (labels se muestran con pipe)
  tiempos: string[] = (Object.values(TiempoPlan).filter(v => typeof v === 'string') as string[]);

  // Form
  form = inject(FormBuilder).nonNullable.group({
    gimnasioId:   [null as number | null, []],                       // requerido solo admin
    idEntrenador: [null as number | null, [Validators.required]],
    idSocio:      ['', [Validators.required, Validators.pattern(/^\d+$/)]],
    tiempo:       [this.tiempos[0] as string, [Validators.required]],
    precio:       [0, [Validators.required, Validators.min(0)]],
  });

  // Modal
  mostrarResumen = signal(false);
  guardando = false;

  // ===== Helpers =====
  /** id tolerante a {idEntrenador} o {id} */
  private entrenadorId(e: any): number { return Number(e?.idEntrenador ?? e?.id ?? 0); }

  /** GETTER reactivo a la CD de Angular (no usa señales) */
  get entrenadorSel(): EntrenadorData | null {
    const id = Number(this.form.controls.idEntrenador.value ?? 0);
    if (!id) return null;
    const fuente = this.entrenadoresFiltrados.length ? this.entrenadoresFiltrados : this.entrenadores;
    return fuente.find(e => this.entrenadorId(e) === id) ?? null;
  }

  ngOnInit(): void {
    this.resolverContextoDesdeToken();
    this.resolverAdminDesdeToken();

    if (this.isAdmin) {
      this.form.controls.gimnasioId.addValidators([Validators.required]);
      this.cargarGimnasiosPrimero();
    } else {
      this.cargarEntrenadores();
    }

    // Cambio de gimnasio -> filtra entrenadores
    this.form.controls.gimnasioId.valueChanges.subscribe((id) => {
      this.filtrarEntrenadoresPorGym(Number(id ?? 0));
    });
  }

  // === Contexto ===
  private resolverContextoDesdeToken(): void {
    const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!token) return;
    try {
      const decoded: any = this.jwt.decodeToken(token);
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;

      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (idGym) {
        this.gymSrv.buscarPorId(Number(idGym)).subscribe({
          next: (g) => (this.gym = g),
          error: () => (this.gym = null),
        });
      }
    } catch {}
  }

  private resolverAdminDesdeToken(): void {
    const raw = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!raw) { this.isAdmin = false; return; }
    try {
      const d: any = this.jwt.decodeToken(raw);
      const roles: string[] = [
        ...(Array.isArray(d?.roles) ? d.roles : []),
        ...(Array.isArray(d?.authorities) ? d.authorities : []),
        ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
      ].concat([d?.role, d?.rol, d?.perfil].filter(Boolean) as string[])
       .map(r => String(r).toUpperCase());
      this.isAdmin = d?.is_admin === true || roles.includes('ADMIN') || roles.includes('ROLE_ADMIN');
    } catch { this.isAdmin = false; }
  }

  // === Catálogos ===
  private cargarGimnasiosPrimero(): void {
    this.cargandoGimnasios = true;
    this.gymSrv.buscarTodos()
      .pipe(
        finalize(() => (this.cargandoGimnasios = false)),
        switchMap(lista => {
          const vistos = new Set<number>();
          this.gimnasios = (lista ?? []).map((g: any) => ({
            idGimnasio: typeof g.idGimnasio === 'number' ? g.idGimnasio : Number(g.id),
            nombre: g.nombre, direccion: g.direccion, telefono: g.telefono
          } as GimnasioData)).filter(g => {
            if (!g.idGimnasio || vistos.has(g.idGimnasio)) return false;
            vistos.add(g.idGimnasio); return true;
          });
          if (this.gimnasios.length === 1) this.form.controls.gimnasioId.setValue(this.gimnasios[0].idGimnasio);
          return of(true);
        })
      )
      .subscribe({ next: () => this.cargarEntrenadores() });
  }

  private cargarEntrenadores(): void {
    this.cargandoEntrenadores = true;
    this.entrenadorSrv.buscarTodos()
      .pipe(finalize(() => (this.cargandoEntrenadores = false)))
      .subscribe({
        next: (lista: any[]) => {
          const vistos = new Set<number>();
          this.entrenadores = (lista ?? []).map((e: any) => {
            const gym = e.gimnasio ?? {};
            const gymId = typeof gym.idGimnasio === 'number' ? gym.idGimnasio : Number(gym.id);
            return {
              idEntrenador: typeof e.idEntrenador === 'number' ? e.idEntrenador : Number(e.id),
              nombre: e.nombre,
              apellido: e.apellido,
              gimnasio: gymId ? { idGimnasio: gymId, nombre: gym.nombre, direccion: gym.direccion, telefono: gym.telefono } : undefined
            } as EntrenadorData;
          }).filter((e: EntrenadorData) => {
            const ok = !!e.idEntrenador && !vistos.has(e.idEntrenador!);
            if (ok) vistos.add(e.idEntrenador!);
            return ok;
          });

          const gid = Number(this.form.controls.gimnasioId.value ?? 0);
          this.filtrarEntrenadoresPorGym(gid);
        },
        error: () => this.noti.error('No se pudieron cargar los entrenadores.')
      });
  }

  private filtrarEntrenadoresPorGym(idGym: number): void {
    if (!this.isAdmin || !idGym) {
      this.entrenadoresFiltrados = [...this.entrenadores];
      return;
    }
    this.entrenadoresFiltrados = this.entrenadores.filter((e: any) => {
      const g = e.gimnasio ?? {};
      const gid = Number(g.idGimnasio ?? g.id ?? 0);
      return gid === Number(idGym);
    });

    const actual = Number(this.form.controls.idEntrenador.value ?? 0);
    if (actual && !this.entrenadoresFiltrados.some(x => this.entrenadorId(x) === actual)) {
      this.form.controls.idEntrenador.setValue(null);
    }
  }

  // === Socio ===
  buscarSocio(): void {
    if (this.form.controls.idSocio.invalid) {
      this.noti.aviso('Ingresa un ID de socio válido (solo dígitos).');
      this.form.controls.idSocio.markAsTouched();
      return;
    }
    const id = Number(this.form.controls.idSocio.value);
    this.cargandoSocio = true;
    this.socio = null;
    this.socioSrv.buscarPorId(id).pipe(finalize(() => (this.cargandoSocio = false)))
      .subscribe({
        next: (s) => { if (!s) this.noti.error('Socio no encontrado.'); this.socio = s; },
        error: () => this.noti.error('No se pudo cargar el socio.')
      });
  }

  // === Resumen / Confirmación ===
  abrirResumen(): void {
    if (this.isAdmin && !this.form.controls.gimnasioId.value) { this.noti.aviso('Selecciona un gimnasio.'); this.form.controls.gimnasioId.markAsTouched(); return; }
    if (!this.form.controls.idEntrenador.value) { this.noti.aviso('Selecciona un entrenador.'); return; }
    if (!this.socio?.idSocio) { this.noti.aviso('Primero busca y selecciona un socio.'); return; }
    if (this.form.controls.precio.invalid) { this.noti.aviso('Ingresa un precio válido.'); this.form.controls.precio.markAsTouched(); return; }
    this.mostrarResumen.set(true);
  }
  cerrarResumen(): void { this.mostrarResumen.set(false); }

  confirmarDesdeModal(pagos: PagoData[]): void {
    if (this.guardando) return;

    const precio = Number(this.form.controls.precio.value ?? 0);
    const suma = (pagos ?? []).reduce((a, p) => a + (Number(p.monto) || 0), 0);
    if (Math.abs(suma - precio) > 0.01) { this.noti.aviso('La suma de los pagos no coincide con el precio.'); return; }

    const socioNombre = `${this.socio?.nombre ?? ''} ${this.socio?.apellido ?? ''}`.trim();
    const entrenadorNombre = `${this.entrenadorSel?.nombre ?? ''} ${this.entrenadorSel?.apellido ?? ''}`.trim();

    const req: AsesoriaCreateRequest = {
      precio,
      tiempo: this.form.controls.tiempo.value as unknown as TiempoPlan,
      entrenador: { idEntrenador: this.form.controls.idEntrenador.value! } as EntrenadorData,
      socio: { idSocio: Number(this.form.controls.idSocio.value) } as SocioData,
      pagos: (pagos ?? []).map(p => ({ ...p, fechaPago: new Date().toISOString() })),
      ...(this.isAdmin ? { gimnasio: ({ id: Number(this.form.controls.gimnasioId.value) } as unknown as GimnasioData) } : {})
    };

    this.guardando = true;
    this.asesoriaSrv.guardar(req as any)
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (resp: any) => {
          this.cerrarResumen();
          this.noti.exito('Accesoría registrada correctamente.');

          const item = {
            idProducto: 0,
            nombre: `Accesoría — ${this.form.controls.tiempo.value} con ${entrenadorNombre}`.trim(),
            precioUnit: precio,
            cantidad: 1,
          };

          const ctx: VentaContexto = crearContextoTicket(this.gym, this.cajero);
          ctx.socio = `${socioNombre} • Entrenador: ${entrenadorNombre}`;

          const money = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n);
          const labelPagos =
            (pagos ?? []).filter(p => (p?.monto ?? 0) > 0)
              .map(p => `${p.tipoPago === 'EFECTIVO' ? 'Efectivo' : p.tipoPago === 'TARJETA' ? 'Tarjeta' : 'Transferencia'}: ${money(Number(p.monto) || 0)}`)
              .join(' · ');

          this.ticket.verVentaDesdeCarrito(
            [item as any],
            ctx,
            labelPagos || '—',
            (resp?.idAsesoriaPersonalizada ?? resp?.id ?? undefined),
            new Date()
          );

          this.resetUI();
        },
        error: () => this.noti.error('No se pudo registrar la asesoria.')
      });
  }

  resetUI(): void {
    if (this.isAdmin) {
      const gid = this.form.controls.gimnasioId.value;
      this.form.reset({ gimnasioId: gid, idEntrenador: null, idSocio: '', tiempo: this.tiempos[0], precio: 0 });
    } else {
      this.form.reset({ gimnasioId: null, idEntrenador: null, idSocio: '', tiempo: this.tiempos[0], precio: 0 });
    }
    this.socio = null;
  }
}
