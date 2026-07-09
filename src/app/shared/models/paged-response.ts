// src/app/model/paged-response.ts
export interface InfoPagina {
  tamanio: number; // tamaño de página
  numero: number; // página actual, base 0
  totalElementos: number;
  totalPaginas: number;
}

export interface PagedResponse<T> {
  contenido: T[];
  pagina?: InfoPagina;
}

// Adaptador para respuestas tipo Spring Data (content/page) a nuestro formato (contenido/pagina)
export function toPagedResponse<T>(raw: any): PagedResponse<T> {
  const contenido = (raw?.contenido ?? raw?.content ?? []) as T[];
  const p = raw?.pagina ?? raw?.page;
  const pagina: InfoPagina | undefined = p
    ? {
        tamanio: p?.tamanio ?? p?.size ?? 0,
        numero: p?.numero ?? p?.number ?? 0,
        totalElementos: p?.totalElementos ?? p?.totalElements ?? 0,
        totalPaginas: p?.totalPaginas ?? p?.totalPages ?? 0,
      }
    : undefined;
  return { contenido, pagina };
}
