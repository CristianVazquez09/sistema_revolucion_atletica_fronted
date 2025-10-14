import { Injectable } from '@angular/core';
import { GenericService } from './generic-service';
import { EntrenadorData } from '../model/entrenador-data';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EntrenadorService extends GenericService<EntrenadorData> {

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/entrenadores`)
  }
  
}
