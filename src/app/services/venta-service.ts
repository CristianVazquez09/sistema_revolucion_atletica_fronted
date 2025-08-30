import { Injectable } from '@angular/core';
import { VentaData } from '../model/venta-data';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GenericService } from './generic-service';

@Injectable({
  providedIn: 'root'
})
export class VentaService extends GenericService<VentaData>{

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/ventas`)

  }
}
