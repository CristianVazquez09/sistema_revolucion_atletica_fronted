import { Injectable } from '@angular/core';
import { GimnasioData } from '../model/gimnasio-data';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { GenericService } from './generic-service';

@Injectable({
  providedIn: 'root'
})
export class GimnasioService extends GenericService<GimnasioData>{

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/gimnasios`)
  }
  
}
