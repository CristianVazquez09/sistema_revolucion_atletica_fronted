// src/app/util/ticket-contexto.ts
import { VentaContexto } from '../services/ticket-service';
import { GimnasioData } from '../model/gimnasio-data';

export function crearContextoTicket(gym: GimnasioData | null, cajero: string): VentaContexto {
  const negocio = {
    nombre: gym?.nombre ?? 'Tu gimnasio',
    direccion: gym?.direccion ?? '',
    telefono: gym?.telefono ?? ''
  };
  const ctx: VentaContexto = {
    negocio,
    cajero,
    leyendaLateral: negocio.nombre,
    brandTitle: 'REVOLUCIÓN ATLÉTICA'
  };
  return ctx;
}
