import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  // true = sidebar abierto
  readonly sidebarOpen = signal(false);

  open()  { this.sidebarOpen.set(true); }
  close() { this.sidebarOpen.set(false); }
  toggle(){ this.sidebarOpen.update(v => !v); }
}
