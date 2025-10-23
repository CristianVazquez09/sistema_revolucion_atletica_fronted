import { Injectable } from '@angular/core';
import { EntrenadorData } from '../model/entrenador-data';
import { GenericService } from './generic-service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AsesoriaService extends GenericService<EntrenadorData>{

  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/asesorias`)
  }

  
}
