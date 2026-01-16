export type TurnoInventario = 'MANANA' | 'TARDE' | 'UNICO';

export interface InventarioDiarioProductoData {
  idProducto: number;
  nombre: string;
  codigo?: string | null;

  stockActual: number;
  vendidos: number;
  entradas: number;

  stockTeorico?: number | null;
}
