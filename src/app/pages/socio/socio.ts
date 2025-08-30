import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  Subscription,
  finalize,
  debounceTime,
  distinctUntilChanged,
  map,
  filter,
  switchMap,
  tap,
} from 'rxjs';

import { SocioService } from '../../services/socio-service';
import { SocioData } from '../../model/socio-data';
import { SocioModal } from './socio-modal/socio-modal';
import { Router } from '@angular/router';
import { NotificacionService } from '../../services/notificacion-service';
import { PagedResponse } from '../../model/paged-response';

@Component({
  selector: 'app-socio',
  standalone: true,
  imports: [CommonModule, SocioModal, FormsModule],
  templateUrl: './socio.html',
  styleUrl: './socio.css',
})
export class Socio implements OnInit, OnDestroy {
  // ─────────── Estado de pantalla ───────────
  listaSocios: SocioData[] = [];
  cargando = true;
  mensajeError: string | null = null;

  // Modal
  modalSocioVisible = signal(false);
  socioActual: SocioData | null = null;

  // ─────────── Paginación ───────────
  paginaActual = 0; // 0-based
  tamanioPagina = 10;
  totalPaginas = 0;
  totalElementos = 0;
  tamaniosDisponibles = [5, 10, 20, 50];

  // ─────────── Búsqueda (con debounce) ───────────
  terminoBusqueda = '';
  private readonly minCaracteresBusqueda = 3;
  private busqueda$ = new Subject<string>();
  private subsBusqueda?: Subscription;

  constructor(private socioService: SocioService, private router:Router, private notificacion:NotificacionService) {}

  // ─────────── Ciclo de vida ───────────
  ngOnInit(): void {
    // Carga inicial (listado normal)
    this.cargarSocios();

    // Pipeline de búsqueda: trim -> debounce -> distinct -> (vacío => listado normal) -> (3+ => buscar)
    this.subsBusqueda = this.busqueda$
      .pipe(
        map((v) => v.trim()),
        debounceTime(400),
        distinctUntilChanged(),
        tap((texto) => {
          // Si limpian el campo (0 caracteres), reset y recarga listado normal
          if (texto.length === 0) {
            this.paginaActual = 0;
            this.cargarSocios();
          }
        }),
        // Solo dispara búsqueda cuando hay 3+ caracteres
        filter((texto) => texto.length >= this.minCaracteresBusqueda),
        switchMap((texto) => {
          this.cargando = true;
          this.mensajeError = null;
          this.paginaActual = 0; // nueva búsqueda => desde la primera página
          return this.socioService
            .buscarSociosPorNombre(texto, this.paginaActual, this.tamanioPagina)
            .pipe(finalize(() => (this.cargando = false)));
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
        error: (err) => {
          console.error(err);
          this.mensajeError = 'No se pudo ejecutar la búsqueda.';
        },
      });
  }

  ngOnDestroy(): void {
    this.subsBusqueda?.unsubscribe();
  }

  // ─────────── Helpers de UI (rango mostrado) ───────────
  get rangoDesde(): number {
    if (this.totalElementos === 0) return 0;
    return this.paginaActual * this.tamanioPagina + 1;
  }
  get rangoHasta(): number {
    const hasta = (this.paginaActual + 1) * this.tamanioPagina;
    return Math.min(hasta, this.totalElementos);
  }

  // ─────────── Carga y manejo de respuestas ───────────
  private aplicarRespuesta(resp: PagedResponse<SocioData>): void {
    this.listaSocios = resp.contenido ?? [];
    this.totalPaginas = resp.pagina?.totalPaginas ?? 0;
    this.totalElementos = resp.pagina?.totalElementos ?? 0;
    this.tamanioPagina = resp.pagina?.tamanio ?? this.tamanioPagina;
    this.paginaActual = resp.pagina?.numero ?? this.paginaActual;

    // Si quedó vacía la página actual (p.ej. tras eliminar), retrocede una y recarga.
    if (this.listaSocios.length === 0 && this.paginaActual > 0) {
      this.paginaActual = this.paginaActual - 1;
      this.cargarSocios();
    }
  }

  cargarSocios(): void {
    this.cargando = true;
    this.mensajeError = null;

    const texto = this.terminoBusqueda.trim();
    const fuente$ =
      texto.length >= this.minCaracteresBusqueda
        ? this.socioService.buscarSociosPorNombre(
            texto,
            this.paginaActual,
            this.tamanioPagina
          )
        : this.socioService.buscarSocios(this.paginaActual, this.tamanioPagina);

    fuente$.pipe(finalize(() => (this.cargando = false))).subscribe({
      next: (resp: PagedResponse<SocioData>) => this.aplicarRespuesta(resp),
      error: (err) => {
        console.error(err);
        this.mensajeError = 'No se pudo cargar la lista de listaSocios.';
      },
    });
  }

  // ─────────── Eventos del buscador ───────────
  onBuscarChange(valor: string): void {
    this.terminoBusqueda = valor;
    this.busqueda$.next(valor);
  }
  limpiarBusqueda(): void {
    this.onBuscarChange('');
  }

  // ─────────── Paginación ───────────
  cambiarTamanioPagina(nuevo: number | string): void {
    this.tamanioPagina = Number(nuevo);
    this.paginaActual = 0; // siempre resetear a la primera
    this.cargarSocios();
  }
  irPrimera(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual = 0;
    this.cargarSocios();
  }
  irAnterior(): void {
    if (this.paginaActual === 0) return;
    this.paginaActual--;
    this.cargarSocios();
  }
  irSiguiente(): void {
    if (this.paginaActual + 1 >= this.totalPaginas) return;
    this.paginaActual++;
    this.cargarSocios();
  }
  irUltima(): void {
    if (this.totalPaginas === 0) return;
    if (this.paginaActual === this.totalPaginas - 1) return;
    this.paginaActual = this.totalPaginas - 1;
    this.cargarSocios();
  }

  // ─────────── Modal ───────────
  abrirModalParaEditar(s: SocioData): void {
    this.socioActual = s;
    this.modalSocioVisible.set(true);
  }
  cerrarModalSocio(): void {
    this.modalSocioVisible.set(false);
  }
  despuesDeGuardarSocio(): void {
    this.cerrarModalSocio();
    this.cargarSocios(); // mantiene página actual si aplica
  }
  eliminarSocio(s: SocioData): void {
    if (!confirm(`¿Eliminar al socio "${s.nombre} ${s.apellido}"?`)) return;
    this.socioService.eliminar(s.idSocio).subscribe({
      next: () => this.cargarSocios(),
      error: () => this.notificacion.error('No se pudo eliminar.'),
    });
  }

  verHistorial(s: SocioData): void {
    if (!s?.idSocio) return;
    this.router.navigate(['/pages/socio', s.idSocio, 'historial']);
  }
}
