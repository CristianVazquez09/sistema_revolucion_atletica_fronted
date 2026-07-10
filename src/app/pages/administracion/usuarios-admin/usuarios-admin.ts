import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UsuarioService } from '../../../services/usuario-service';
import { UsuarioData } from '../../../shared/models/usuario-data';
import { UsuariosAdminModal } from './usuarios-admin-modal/usuarios-admin-modal';

@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, UsuariosAdminModal],
  templateUrl: './usuarios-admin.html',
  styleUrl: './usuarios-admin.css'
})
export class UsuariosAdmin {

  private srv = inject(UsuarioService);

  rows: UsuarioData[] = [];
  cargando = false;
  error: string | null = null;

  // modal
  modalAbierto = signal(false);
  idEditando: number | null = null;
  menuRowIdx: number | null = null;
  menuDropUpIdx: number | null = null;
  menuDropdownStyle: { top?: string; bottom?: string; right: string } | null = null;

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.error = null; this.cargando = true;
    this.srv.buscarTodos().subscribe({
      next: (list) => { this.rows = list ?? []; this.cargando = false; },
      error: () => { this.error = 'No se pudieron cargar los usuarios.'; this.cargando = false; }
    });
  }

  crear(): void { this.idEditando = null; this.modalAbierto.set(true); }
  editar(u: UsuarioData): void { this.idEditando = u.id ?? null; this.modalAbierto.set(true); }
  cerrarModal(): void { this.modalAbierto.set(false); this.idEditando = null; }
  onGuardado(): void { this.cerrarModal(); this.cargar(); }

  eliminar(u: UsuarioData): void {
    if (!u.id) return;
    if (!confirm(`¿Eliminar el usuario "${u.nombreUsuario}" (#${u.id})?`)) return;
    this.cargando = true;
    this.srv.eliminar(u.id).subscribe({
      next: () => { this.cargando = false; this.cargar(); },
      error: () => { this.cargando = false; this.error = 'No se pudo eliminar el usuario.'; }
    });
  }

  rolPrincipal(u: UsuarioData): string {
    return u?.roles?.[0]?.nombre ?? '—';
  }

  gymNombre(u: UsuarioData): string {
    const g: any = u?.gimnasio;
    return g?.nombre ?? (g?.id ?? g?.idGimnasio ? `#${g?.id ?? g?.idGimnasio}` : '—');
  }

  trackById = (_: number, it: UsuarioData) => it.id!;

  @HostListener('document:click')
  closeMenuRows(): void { this.menuRowIdx = null; this.menuDropUpIdx = null; this.menuDropdownStyle = null; }

  toggleMenuRow(i: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.menuRowIdx === i) {
      this.menuRowIdx = null;
      this.menuDropUpIdx = null;
      this.menuDropdownStyle = null;
      return;
    }
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = 130;
    const gap = 4;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const spaceBelow = viewportHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + gap;
    this.menuRowIdx = i;
    this.menuDropUpIdx = openUp ? i : null;
    this.menuDropdownStyle = openUp
      ? { bottom: `${viewportHeight - rect.top + gap}px`, right: `${window.innerWidth - rect.right}px` }
      : { top: `${rect.bottom + gap}px`, right: `${window.innerWidth - rect.right}px` };
  }
}


