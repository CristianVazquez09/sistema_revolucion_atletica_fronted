import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { MenuData } from '../model/menu-data';
import { GenericService } from './generic-service';

@Injectable({
  providedIn: 'root'
})
export class MenuService extends GenericService<MenuData> {

  private menuChange = new Subject<MenuData[]>();

  constructor(http: HttpClient) {
    super(
      http,
      `${environment.HOST}/menus`);
  }

  getMenusByUser(username: string){
    return this.http.post<MenuData[]>(`${this.url}/usuario`, username);
  }

  getMenuChange(){
    return this.menuChange.asObservable();
  }

  setMenuChange(menus: MenuData[]){
    this.menuChange.next(menus);
  }

  readonly menuAbierto = signal(false);

  toggleDrawer(): void { this.menuAbierto.update(v => !v); }
  abrirDrawer(): void { this.menuAbierto.set(true); }
  cerrarDrawer(): void { this.menuAbierto.set(false); }
  
}
