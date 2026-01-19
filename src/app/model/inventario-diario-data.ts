export type TurnoInventario = 'MANANA' | 'TARDE' | 'UNICO';

export interface InventarioDiarioProductoData {
  idProducto: number;
  nombre: string;
  codigo?: string | null;

  stockInicio: number;
  entradas: number;
  ajustes: number;
  vendidos: number;
  stockFin: number;
}

export interface InventarioTurnoResponseData {
  fechaOperativa: string; // YYYY-MM-DD
  turno: TurnoInventario;
  cerrado: boolean;

  fechaCierre?: string | null; // ISO
  cerradoPor?: string | null;

  items: InventarioDiarioProductoData[];
}

export interface InventarioCierreRequestData {
  fecha: string; // YYYY-MM-DD
  turno: TurnoInventario;
  // gimnasioId?: number | null; // solo si lo manejas en backend (opcional)
}

export interface InventarioCierreResultadoData {
  fecha: string;
  turno: TurnoInventario;
  productosCerrados: number;
  fechaCierre: string; // ISO
}
