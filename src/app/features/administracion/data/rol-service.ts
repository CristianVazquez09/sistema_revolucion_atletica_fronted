import { Injectable } from '@angular/core';
import { RolData } from '../../../shared/models/rol-data';
import { GenericService } from '../../../core/http/generic-service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RolService extends GenericService<RolData>{
  
  constructor(protected override http: HttpClient){
    super(http, `${environment.HOST}/roles`)
  }
}
