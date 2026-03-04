// src/app/util/ticket-contexto.ts
import { VentaContexto } from '../services/ticket-service';
import { GimnasioData } from '../model/gimnasio-data';

/**
 * Devuelve el nombre para mostrar en tickets.
 * Prioridad: "nombre apellido" del token → username de sessionStorage → fallback.
 */
export function obtenerNombreCajero(fallback?: string): string {
  const nombre   = (sessionStorage.getItem('nombre')   ?? '').trim();
  const apellido = (sessionStorage.getItem('apellido') ?? '').trim();
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ');
  return nombreCompleto || (sessionStorage.getItem('username') ?? '').trim() || fallback || 'Cajero';
}

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
