import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificacionHost } from './pages/notificacion-host/notificacion-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificacionHost],
  templateUrl: './app.html',
})
export class App {}
