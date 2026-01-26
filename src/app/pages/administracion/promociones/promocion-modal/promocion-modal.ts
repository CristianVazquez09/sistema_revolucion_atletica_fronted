import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap } from 'rxjs';

import { PromocionService } from 'src/app/services/promocion-service';
import { NotificacionService } from 'src/app/services/notificacion-service';

import { labelTipoPromocion, TipoPromocion } from 'src/app/util/enums/tipo-promocion';
import { PromocionData, PromocionUpsertData } from 'src/app/model/promocion-data';
import { PaqueteData } from 'src/app/model/paquete-data';
import { GimnasioData } from 'src/app/model/gimnasio-data';

@Component({
  selector: 'app-promocion-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './promocion-modal.html',
  styleUrl: './promocion-modal.css',
})
export class PromocionModal {
  private destroyRef = inject(DestroyRef);
  private fb = inject(FormBuilder);
  private noti = inject(NotificacionService);
  private servicio = inject(PromocionService);

  @Input() promocion: PromocionData | null = null;
  @Input() paquetes: PaqueteData[] = [];

  @Input() gimnasios: GimnasioData[] = [];
  @Input() isAdmin = false;
  @Input() gimnasioIdSeleccionado: number | null = null;

  @Output() cancelar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  TipoPromocion = TipoPromocion;
  labelTipo = labelTipoPromocion;

  guardando = signal(false);
  gestionPaquetesBusy = signal(false);

  esEdicion = computed(() => !!(this.promocion as any)?.idPromocion);
  idPromocion = computed(() => this.toNum((this.promocion as any)?.idPromocion));

  titulo = computed(() => (this.esEdicion() ? 'Editar promoción' : 'Agregar promoción'));

  // ✅ puente: FormControl gimnasioId -> Signal (para que computed reaccione)
  gimnasioIdSig = signal<number | null>(null);

  // estado local de paquetes vinculados
  paquetesVinculados = signal<PaqueteData[]>([]);

  form = this.fb.group({
    gimnasioId: [null as number | null],

    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: ['', [Validators.maxLength(255)]],

    fechaInicio: ['', [Validators.required]],
    fechaFin: ['', [Validators.required]],

    tipo: [TipoPromocion.DESCUENTO_PORCENTAJE as any, [Validators.required]],

    descuentoPorcentaje: [null as number | null],
    descuentoMonto: [null as number | null],
    mesesGratis: [null as number | null],

    soloNuevos: [false],
    sinCostoInscripcion: [false],

    paqueteAddId: [null as number | null],
  });

  // =========================
  // Helpers para template
  // =========================
  toNum(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  paqId(p: PaqueteData | any): number | null {
    return this.toNum((p as any)?.idPaquete ?? (p as any)?.id ?? null);
  }

  paqNombre(p: PaqueteData | any): string {
    const nombre = String((p as any)?.nombre ?? '').trim();
    const id = this.paqId(p);
    return nombre.length ? nombre : (id != null ? `Paquete ${id}` : 'Paquete');
  }

  paqTrack = (index: number, p: PaqueteData): number => {
    return this.paqId(p) ?? index;
  };

  private getGymIdFromPromocion(p: PromocionData | null): number | null {
    const anyP: any = p as any;
    const g: any = anyP?.gimnasio;
    return this.toNum(g?.idGimnasio) ?? this.toNum(g?.id) ?? this.toNum(anyP?.gimnasioId) ?? null;
  }

  private getGymIdFromPaquete(p: PaqueteData | any): number | null {
    const anyP: any = p as any;
    const g: any = anyP?.gimnasio;

    return (
      this.toNum(g?.idGimnasio) ??
      this.toNum(g?.id) ??
      this.toNum(anyP?.gimnasioId) ??
      this.toNum(anyP?.idGimnasio) ??
      this.toNum(anyP?.gimnasio_id) ??
      null
    );
  }

  private promoIdsFromPaquete(paq: any): number[] {
    const raw =
      (Array.isArray(paq?.promociones) ? paq.promociones : null) ??
      (Array.isArray(paq?.promos) ? paq.promos : null) ??
      [];

    const ids = (raw ?? [])
      .map((x: any) => x?.idPromocion ?? x?.id ?? x)
      .map((x: any) => this.toNum(x))
      .filter((x: any) => typeof x === 'number') as number[];

    return Array.from(new Set(ids));
  }

  private resolverPaquetesVinculadosDesdeInputs(): PaqueteData[] {
    const idPromo = this.idPromocion();
    if (!idPromo) return this.paquetesVinculados();

    const anyPromo: any = this.promocion as any;
    const ps =
      (Array.isArray(anyPromo?.paquetes) ? anyPromo.paquetes : []) ||
      (anyPromo?.paquete ? [anyPromo.paquete] : []);
    const fromPromo = (ps ?? []).filter(Boolean);

    if (fromPromo.length) return fromPromo;

    return (this.paquetes ?? []).filter((p: any) => this.promoIdsFromPaquete(p).includes(idPromo));
  }

  // ✅ ahora sí: filtra por gimnasio usando la SIGNAL (reactiva)
  private paquetesFiltradosPorGymComputed = computed(() => {
    const base = (this.paquetes ?? []).filter((p: any) => p?.activo !== false);

    if (!this.isAdmin) return base;

    const gymId = this.gimnasioIdSig();
    if (!gymId) return [];

    return base.filter((p: any) => this.getGymIdFromPaquete(p) === gymId);
  });

  paquetesDisponiblesParaAgregar = computed(() => {
    // dependencia explícita para que se recalculen al cambiar gym
    const base = this.paquetesFiltradosPorGymComputed();

    const vinculadosIds = new Set(
      (this.paquetesVinculados() ?? [])
        .map((p) => this.paqId(p))
        .filter((x): x is number => typeof x === 'number')
    );

    return base.filter((p) => {
      const id = this.paqId(p);
      return id != null && !vinculadosIds.has(id);
    });
  });

  ngOnInit(): void {
    // ✅ inicializa paquetes vinculados
    this.paquetesVinculados.set(this.resolverPaquetesVinculadosDesdeInputs());

    if (this.isAdmin) {
      this.form.controls['gimnasioId'].addValidators([Validators.required]);

      const promoGymId = this.getGymIdFromPromocion(this.promocion);
      const fallback =
        promoGymId ??
        this.gimnasioIdSeleccionado ??
        (this.gimnasios?.length ? this.gimnasios[0].idGimnasio : null);

      if (fallback != null) {
        this.form.controls['gimnasioId'].setValue(fallback);
        this.gimnasioIdSig.set(fallback); // ✅ set inicial para computed
      }

      // ✅ cada cambio del select actualiza la SIGNAL (y se recalcula el computed)
      this.form.get('gimnasioId')?.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((val) => {
          const nuevo = this.toNum(val);

          // bloqueo en edición si ya hay paquetes vinculados
          if (this.esEdicion() && (this.paquetesVinculados() ?? []).length) {
            const actual = this.getGymIdFromPromocion(this.promocion);
            this.form.get('gimnasioId')?.setValue(actual, { emitEvent: false });
            this.gimnasioIdSig.set(actual); // ✅ mantener sincronizado
            this.noti.error('Para cambiar el gimnasio primero desvincula todos los paquetes (o crea una nueva promoción).');
            return;
          }

          this.gimnasioIdSig.set(nuevo);

          // creación: si cambian gym, limpia paquetes vinculados que no correspondan
          if (!this.esEdicion() && nuevo != null) {
            const filtrados = (this.paquetesVinculados() ?? []).filter((p: any) => this.getGymIdFromPaquete(p) === nuevo);
            if (filtrados.length !== (this.paquetesVinculados() ?? []).length) {
              this.paquetesVinculados.set(filtrados);
            }
          }

          // si el select "Agregar paquete" traía un id previo, límpialo
          this.form.get('paqueteAddId')?.setValue(null, { emitEvent: false });
        });
    }

    // ✅ precarga datos si viene edición
    if (this.promocion) {
      this.form.patchValue({
        nombre: (this.promocion as any)?.nombre ?? '',
        descripcion: (this.promocion as any)?.descripcion ?? '',
        fechaInicio: (this.promocion as any)?.fechaInicio ?? '',
        fechaFin: (this.promocion as any)?.fechaFin ?? '',
        tipo: ((this.promocion as any)?.tipo as any) ?? TipoPromocion.DESCUENTO_PORCENTAJE,
        descuentoPorcentaje: (this.promocion as any)?.descuentoPorcentaje ?? null,
        descuentoMonto: (this.promocion as any)?.descuentoMonto ?? null,
        mesesGratis: (this.promocion as any)?.mesesGratis ?? null,
        soloNuevos: !!(this.promocion as any)?.soloNuevos,
        sinCostoInscripcion: !!(this.promocion as any)?.sinCostoInscripcion,
      });
    }

    this.form.get('tipo')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.normalizeByTipo());
  }

  cerrar(): void {
    if (this.guardando() || this.gestionPaquetesBusy()) return;
    this.cancelar.emit();
  }

  paqueteOptionLabel(p: PaqueteData): string {
    return this.paqNombre(p);
  }

  agregarPaquete(): void {
    if (this.gestionPaquetesBusy()) return;

    const idPaq = this.toNum(this.form.get('paqueteAddId')?.value);
    if (!idPaq) {
      this.noti.error('Selecciona un paquete.');
      return;
    }

    const existe = (this.paquetesVinculados() ?? []).some((x) => this.paqId(x) === idPaq);
    if (existe) {
      this.noti.error('Ese paquete ya está vinculado.');
      return;
    }

    const paquete = (this.paquetes ?? []).find((p: any) => this.toNum(p?.idPaquete) === idPaq) as PaqueteData | undefined;
    if (!paquete) {
      this.noti.error('No se encontró el paquete.');
      return;
    }

    if (this.isAdmin) {
      const gymId = this.gimnasioIdSig();
      const gymPaq = this.getGymIdFromPaquete(paquete);
      if (gymId != null && gymPaq != null && gymId !== gymPaq) {
        this.noti.error('El paquete seleccionado no pertenece al gimnasio destino.');
        return;
      }
    }

    const idPromo = this.idPromocion();
    if (this.esEdicion() && idPromo) {
      this.gestionPaquetesBusy.set(true);
      this.servicio.vincularPaquete(idPromo, idPaq)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.gestionPaquetesBusy.set(false);
            this.paquetesVinculados.update((lst) => [...(lst ?? []), paquete]);
            this.form.get('paqueteAddId')?.setValue(null);
            this.noti.exito('Paquete vinculado.');
          },
          error: (err) => {
            console.error(err);
            this.gestionPaquetesBusy.set(false);
            this.noti.error('No se pudo vincular el paquete.');
          },
        });
      return;
    }

    this.paquetesVinculados.update((lst) => [...(lst ?? []), paquete]);
    this.form.get('paqueteAddId')?.setValue(null);
  }

  quitarPaquete(paq: PaqueteData): void {
    if (this.gestionPaquetesBusy()) return;

    const idPaq = this.paqId(paq);
    if (!idPaq) return;

    if (!confirm(`¿Quitar el paquete "${this.paqNombre(paq)}" de esta promoción?`)) return;

    const idPromo = this.idPromocion();

    if (this.esEdicion() && idPromo) {
      this.gestionPaquetesBusy.set(true);
      this.servicio.desvincularPaquete(idPromo, idPaq)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.gestionPaquetesBusy.set(false);
            this.paquetesVinculados.update((lst) => (lst ?? []).filter((x) => this.paqId(x) !== idPaq));
            this.noti.exito('Paquete desvinculado.');
          },
          error: (err) => {
            console.error(err);
            this.gestionPaquetesBusy.set(false);
            this.noti.error('No se pudo desvincular el paquete.');
          },
        });
      return;
    }

    this.paquetesVinculados.update((lst) => (lst ?? []).filter((x) => this.paqId(x) !== idPaq));
  }

  // ======= Renovar: bloquea si sigue vigente =======
  private promoSigueVigente(): boolean {
    if (!this.esEdicion()) return false;

    const activo = (this.promocion as any)?.activo;
    if (activo === false) return false;

    const ini = this.toLocalDate(String(this.form.get('fechaInicio')?.value ?? '').trim());
    const fin = this.toLocalDate(String(this.form.get('fechaFin')?.value ?? '').trim());
    if (!ini || !fin) return false;

    const hoy = this.hoy();
    return hoy.getTime() >= ini.getTime() && hoy.getTime() <= fin.getTime();
  }

  renovar(): void {
    if (!this.esEdicion()) return;
    if (this.guardando() || this.gestionPaquetesBusy()) return;

    if (this.promoSigueVigente()) {
      this.noti.error('No se puede renovar porque la promoción aún está vigente.');
      return;
    }

    if (!confirm('¿Renovar promoción? Se creará una nueva promoción con fechas desde hoy y los mismos paquetes.')) return;

    const ini = this.toLocalDate(String(this.form.get('fechaInicio')?.value ?? '').trim());
    const fin = this.toLocalDate(String(this.form.get('fechaFin')?.value ?? '').trim());
    const dur = ini && fin ? Math.max(1, Math.round((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24))) : 7;

    const hoy = this.hoy();
    const nuevoIni = this.formatDate(hoy);
    const nuevoFin = this.formatDate(this.addDays(hoy, dur));

    const tipo = this.form.get('tipo')?.value as TipoPromocion | string;
    const gymId = this.isAdmin ? this.gimnasioIdSig() : null;

    const payload: PromocionUpsertData = {
      nombre: String(this.form.get('nombre')?.value ?? '').trim(),
      descripcion: String(this.form.get('descripcion')?.value ?? '').trim() || null,

      fechaInicio: nuevoIni,
      fechaFin: nuevoFin,

      tipo: String(tipo),

      descuentoPorcentaje: tipo === TipoPromocion.DESCUENTO_PORCENTAJE ? Number(this.form.get('descuentoPorcentaje')?.value) : null,
      descuentoMonto: tipo === TipoPromocion.DESCUENTO_MONTO ? Number(this.form.get('descuentoMonto')?.value) : null,
      mesesGratis: tipo === TipoPromocion.MESES_GRATIS ? Number(this.form.get('mesesGratis')?.value) : null,

      soloNuevos: !!this.form.get('soloNuevos')?.value,
      sinCostoInscripcion: !!this.form.get('sinCostoInscripcion')?.value,

      activo: true,
      ...(this.isAdmin ? { gimnasio: { id: gymId as number } } : {}),
    };

    const paquetesIds = (this.paquetesVinculados() ?? [])
      .map((p) => this.paqId(p))
      .filter((x): x is number => typeof x === 'number');

    this.guardando.set(true);

    this.servicio.crear(payload)
      .pipe(
        switchMap((resp) => {
          const newId = this.toNum((resp as any)?.idPromocion);
          if (!newId || !paquetesIds.length) return of(resp);

          return forkJoin(paquetesIds.map((idPaq) => this.servicio.vincularPaquete(newId, idPaq)))
            .pipe(switchMap(() => of(resp)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.noti.exito('Promoción renovada (se creó una nueva).');
          this.guardado.emit();
        },
        error: (err) => {
          console.error(err);
          this.guardando.set(false);
          this.noti.error('No se pudo renovar la promoción.');
        },
      });
  }

  // ======= Guardar (igual que ya lo tenías; si quieres lo integramos también) =======
  guardar(): void {
  if (this.guardando() || this.gestionPaquetesBusy()) return;

  // 1) Validación general del form
  this.form.markAllAsTouched();

  // Admin: gimnasio obligatorio
  if (this.isAdmin) {
    const gymId = this.toNum(this.form.get('gimnasioId')?.value);
    if (!gymId) {
      this.noti.error('Selecciona un gimnasio.');
      return;
    }
  }

  const nombre = String(this.form.get('nombre')?.value ?? '').trim();
  if (!nombre) {
    this.noti.error('El nombre es requerido.');
    return;
  }

  const fechaInicioStr = String(this.form.get('fechaInicio')?.value ?? '').trim();
  const fechaFinStr = String(this.form.get('fechaFin')?.value ?? '').trim();

  const ini = this.toLocalDate(fechaInicioStr);
  const fin = this.toLocalDate(fechaFinStr);

  if (!ini) {
    this.noti.error('Fecha inicio inválida.');
    return;
  }
  if (!fin) {
    this.noti.error('Fecha fin inválida.');
    return;
  }
  if (fin.getTime() < ini.getTime()) {
    this.noti.error('La fecha fin no puede ser anterior a la fecha inicio.');
    return;
  }

  const tipo = this.form.get('tipo')?.value as TipoPromocion | string;
  if (!tipo) {
    this.noti.error('Selecciona el tipo de promoción.');
    return;
  }

  // 2) Normalizar campos según tipo (limpia los que no aplican)
  this.normalizeByTipo();

  // 3) Validación por tipo
  const pctRaw = this.toNum(this.form.get('descuentoPorcentaje')?.value);
  const montoRaw = this.toNum(this.form.get('descuentoMonto')?.value);
  const mesesRaw = this.toNum(this.form.get('mesesGratis')?.value);

  if (tipo === TipoPromocion.DESCUENTO_PORCENTAJE) {
    const pct = Number(pctRaw ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) {
      this.noti.error('El descuento porcentaje debe ser mayor a 0.');
      return;
    }
    if (pct > 100) {
      this.noti.error('El descuento porcentaje no puede ser mayor a 100.');
      return;
    }
  }

  if (tipo === TipoPromocion.DESCUENTO_MONTO) {
    const m = Number(montoRaw ?? 0);
    if (!Number.isFinite(m) || m <= 0) {
      this.noti.error('El descuento monto debe ser mayor a 0.');
      return;
    }
  }

  if (tipo === TipoPromocion.MESES_GRATIS) {
    const mg = Number(mesesRaw ?? 0);
    if (!Number.isFinite(mg) || mg <= 0) {
      this.noti.error('Meses gratis debe ser mayor a 0.');
      return;
    }
    // si quieres permitir solo enteros:
    if (!Number.isInteger(mg)) {
      this.noti.error('Meses gratis debe ser un número entero.');
      return;
    }
  }

  // 4) Construir payload
  const gymId = this.isAdmin ? this.gimnasioIdSig() : null;

  const payload: PromocionUpsertData = {
    nombre,
    descripcion: String(this.form.get('descripcion')?.value ?? '').trim() || null,

    fechaInicio: fechaInicioStr,
    fechaFin: fechaFinStr,

    tipo: String(tipo),

    descuentoPorcentaje:
      tipo === TipoPromocion.DESCUENTO_PORCENTAJE ? Number(pctRaw) : null,
    descuentoMonto:
      tipo === TipoPromocion.DESCUENTO_MONTO ? Number(montoRaw) : null,
    mesesGratis:
      tipo === TipoPromocion.MESES_GRATIS ? Number(mesesRaw) : null,

    soloNuevos: !!this.form.get('soloNuevos')?.value,
    sinCostoInscripcion: !!this.form.get('sinCostoInscripcion')?.value,

    activo: true,

    ...(this.isAdmin ? { gimnasio: { id: gymId as number } } : {}),
  };

  // Paquetes seleccionados (solo importan para CREAR o para validar que haya al menos 1 si tú quieres)
  const paquetesIds = (this.paquetesVinculados() ?? [])
    .map((p) => this.paqId(p))
    .filter((x): x is number => typeof x === 'number');

  // Si quieres exigir al menos 1 paquete vinculado:
  if (!paquetesIds.length) {
    this.noti.error('Vincula al menos un paquete a la promoción.');
    return;
  }

  // 5) Crear vs editar
  this.guardando.set(true);

  const idPromo = this.idPromocion();

  // === EDITAR ===
  if (this.esEdicion() && idPromo) {
    // Nota: aquí NO hacemos “sync total” de paquetes porque tu UX ya vincula/desvincula con botones.
    // Solo actualizamos datos de la promo.
    this.servicio.actualizarPromocion(idPromo, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.noti.exito('Promoción actualizada.');
          this.guardado.emit();
        },
        error: (err) => {
          console.error(err);
          this.guardando.set(false);
          this.noti.error('No se pudo actualizar la promoción.');
        },
      });

    return;
  }

  // === CREAR ===
  this.servicio.crear(payload)
    .pipe(
      switchMap((resp) => {
        const newId =
          this.toNum((resp as any)?.idPromocion) ??
          this.toNum((resp as any)?.id);

        if (!newId) {
          // si el backend no devuelve id, igual emitimos guardado y ya
          return of(resp);
        }

        if (!paquetesIds.length) return of(resp);

        // Vincular todos los paquetes seleccionados
        this.gestionPaquetesBusy.set(true);

        return forkJoin(paquetesIds.map((idPaq) => this.servicio.vincularPaquete(newId, idPaq)))
          .pipe(
            switchMap(() => of(resp))
          );
      }),
      takeUntilDestroyed(this.destroyRef)
    )
    .subscribe({
      next: () => {
        this.guardando.set(false);
        this.gestionPaquetesBusy.set(false);
        this.noti.exito('Promoción creada.');
        this.guardado.emit();
      },
      error: (err) => {
        console.error(err);
        this.guardando.set(false);
        this.gestionPaquetesBusy.set(false);
        this.noti.error('No se pudo guardar la promoción.');
      },
    });
}


  mostrarPorcentaje(): boolean {
    return this.form.get('tipo')?.value === TipoPromocion.DESCUENTO_PORCENTAJE;
  }
  mostrarMonto(): boolean {
    return this.form.get('tipo')?.value === TipoPromocion.DESCUENTO_MONTO;
  }
  mostrarMeses(): boolean {
    return this.form.get('tipo')?.value === TipoPromocion.MESES_GRATIS;
  }

  private normalizeByTipo(): void {
    const tipo = this.form.get('tipo')?.value;

    if (tipo === TipoPromocion.DESCUENTO_PORCENTAJE) {
      this.form.get('descuentoMonto')?.setValue(null);
      this.form.get('mesesGratis')?.setValue(null);
    } else if (tipo === TipoPromocion.DESCUENTO_MONTO) {
      this.form.get('descuentoPorcentaje')?.setValue(null);
      this.form.get('mesesGratis')?.setValue(null);
    } else if (tipo === TipoPromocion.MESES_GRATIS) {
      this.form.get('descuentoPorcentaje')?.setValue(null);
      this.form.get('descuentoMonto')?.setValue(null);
    }
  }

  private hoy(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private toLocalDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const s = String(iso).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private addDays(d: Date, days: number): Date {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + days);
    return x;
  }
}
