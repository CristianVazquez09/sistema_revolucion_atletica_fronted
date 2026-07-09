import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class GenericService <T> {

    constructor(
    protected http: HttpClient,
    @Inject("url") protected url: string
  ) { }

  buscarTodos(): Observable<T[]> {
    return this.http.get<T[]>(this.url);
  }

  buscarPorId(id: number): Observable<T> {
    return this.http.get<T>(`${this.url}/${id}`);
  }

  guardar(entidad: T): Observable<T> {
    return this.http.post<T>(this.url, entidad);
  }

  actualizar(id: number, entidad: T): Observable<T> {
    return this.http.put<T>(`${this.url}/${id}`, entidad);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
  
}
