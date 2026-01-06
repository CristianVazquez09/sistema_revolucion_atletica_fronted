import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificacionHost } from './pages/notificacion-host/notificacion-host';
import { RaAppZoomComponent } from './shared/ra-app-zoom/ra-app-zoom';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,NotificacionHost, RaAppZoomComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',

})
export class App {

  

}
