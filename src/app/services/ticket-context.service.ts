import { Injectable, inject } from '@angular/core';
import { JwtHelperService } from '@auth0/angular-jwt';
import { GimnasioService } from './gimnasio-service';
import { environment } from '../../environments/environment';

export interface NegocioInfo {
  nombre: string;
  direccion?: string;
  telefono?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketContextService {
  private jwt = inject(JwtHelperService);
  private gymSrv = inject(GimnasioService);

  /** Datos que usarán los tickets (con fallback). */
  negocio: NegocioInfo = { nombre: 'Tu gimnasio', direccion: '', telefono: '' };
  cajero: string = 'Cajero';

  /** Llama esto en ngOnInit de los componentes que imprimen tickets. */
  init(): void {
    const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
    if (!token) return;

    try {
      const decoded: any = this.jwt.decodeToken(token);
      // Cajero
      this.cajero = decoded?.preferred_username ?? decoded?.sub ?? this.cajero;
      // Gym
      const idGym = decoded?.id_gimnasio ?? decoded?.tenantId ?? decoded?.gimnasioId;
      if (!idGym) return;

      this.gymSrv.buscarPorId(Number(idGym)).subscribe({
        next: (g: any) => {
          this.negocio = {
            nombre: g?.nombre ?? 'Tu gimnasio',
            direccion: g?.direccion ?? '',
            // sanea posibles caracteres raros
            telefono: String(g?.telefono ?? '').replace(/[^\d()+\-\s]/g, '').trim()
          };
        },
        error: () => { /* mantener fallback */ }
      });
    } catch {
      /* token inválido: seguimos con fallback */
    }
  }
}
