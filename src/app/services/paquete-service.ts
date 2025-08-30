import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { PaqueteData } from '../model/paquete-data';


@Injectable({
  providedIn: 'root'
})
export class PaqueteService extends GenericService<PaqueteData> {

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/paquetes`)
  }


  
}
