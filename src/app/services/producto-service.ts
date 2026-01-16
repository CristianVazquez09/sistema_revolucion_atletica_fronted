import { Injectable } from '@angular/core';
import { ProductoData } from '../model/producto-data';
import { GenericService } from './generic-service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type StockEntradaRequest = { cantidad: number; nota?: string | null };
export type StockAjusteRequest  = { nuevoStock: number; nota?: string | null };

@Injectable({
  providedIn: 'root'
})
export class ProductoService extends GenericService<ProductoData> {

  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/productos`);
  }

  buscarPorCategoria(idCategoria: number) {
    return this.http.get<ProductoData[]>(`${this.url}/buscar/${idCategoria}`);
  }

  buscarPorNombre(nombreProducto: string) {
    return this.http.get<ProductoData[]>(`${this.url}/buscar/nombre/${nombreProducto}`);
  }

  // ✅ NUEVO: entrada y ajuste de stock (solo Admin/Gerente en backend)
  registrarEntrada(idProducto: number, req: StockEntradaRequest) {
    return this.http.post<ProductoData>(`${this.url}/${idProducto}/stock/entrada`, req);
  }

  ajustarStock(idProducto: number, req: StockAjusteRequest) {
    return this.http.post<ProductoData>(`${this.url}/${idProducto}/stock/ajuste`, req);
  }
}
