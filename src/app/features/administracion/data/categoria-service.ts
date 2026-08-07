import { Injectable } from '@angular/core';
import { CategoriaData } from '../../../shared/models/categoria-data';
import { GenericService } from '../../../core/http/generic-service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CategoriaService extends GenericService<CategoriaData> {
  constructor(protected override http: HttpClient) {
    super(http, `${environment.HOST}/categorias`);
  }
}
