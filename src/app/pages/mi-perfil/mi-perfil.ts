// src/app/pages/mi-perfil/mi-perfil.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

import { UsuarioService } from '../../services/usuario-service';
import { environment } from '../../../environments/environment';
import {
  AvatarStyle,
  FraseHomeMode,
  RA_PREFS_DEFAULT,
  avatarColorByStyle,
  avatarImageByStyle,
  fraseHomeByMode,
  loadPreferenciasUsuario,
  savePreferenciasUsuario,
} from '../../util/preferencias-usuario';

@Component({
  selector: 'app-mi-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mi-perfil.html',
  styles: ``
})
export class MiPerfil implements OnInit {
  private srv = inject(UsuarioService);
  private jwt = inject(JwtHelperService);
  private fb  = inject(FormBuilder);
  private router = inject(Router);

  nombreUsuario = '';
  rolKey: 'admin' | 'gerente' | 'recepcionista' | '' = '';
  rol = '';
  initiales = '';
  guardandoPerfil = false;
  exitoPerfil = false;
  errorPerfil: string | null = null;
  exitoPreferencias = false;
  frasePreview = '';

  perfilForm = this.fb.nonNullable.group({
    nombre:   [''],
    apellido: [''],
  });

  preferenciasForm = this.fb.nonNullable.group({
    avatarStyle: [RA_PREFS_DEFAULT.avatarStyle as AvatarStyle],
    fraseHome: [RA_PREFS_DEFAULT.fraseHome as FraseHomeMode],
  });

  readonly avatarOptions: Array<{ value: AvatarStyle; label: string }> = [
    { value: 'azul', label: 'Azul clasico' },
    { value: 'verde', label: 'Verde energia' },
    { value: 'rojo', label: 'Rojo intenso' },
    { value: 'morado', label: 'Morado vivo' },
    { value: 'sticker_rayo', label: 'Sticker rayo' },
    { value: 'sticker_cohete', label: 'Sticker cohete' },
    { value: 'sticker_estrella', label: 'Sticker estrella' },
    { value: 'sticker_fuego', label: 'Sticker fuego' },
  ];

  readonly fraseModeOptions: Array<{ value: FraseHomeMode; label: string }> = [
    { value: 'clasica', label: 'Clasica' },
    { value: 'motivar', label: 'Motivadora' },
    { value: 'divertida', label: 'Divertida' },
  ];

  ngOnInit(): void {
    this.nombreUsuario = sessionStorage.getItem('username') ?? '';
    this.perfilForm.patchValue({
      nombre:   sessionStorage.getItem('nombre')   ?? '',
      apellido: sessionStorage.getItem('apellido') ?? '',
    });
    this.initiales = this.calcularInitiales();
    this.rolKey = this.detectarRolKey();
    this.rol = this.labelRol(this.rolKey);
    this.cargarPreferencias();
  }

  guardarPerfil(): void {
    this.exitoPerfil = false;
    this.errorPerfil = null;
    const { nombre, apellido } = this.perfilForm.getRawValue();
    const body: any = {};
    if (nombre.trim())   body.nombre   = nombre.trim();
    if (apellido.trim()) body.apellido = apellido.trim();

    this.guardandoPerfil = true;
    this.srv.patchMiPerfil(body).subscribe({
      next: (u) => {
        this.guardandoPerfil = false;
        this.exitoPerfil = true;
        if (u.nombre)   sessionStorage.setItem('nombre',   u.nombre);
        else            sessionStorage.removeItem('nombre');
        if (u.apellido) sessionStorage.setItem('apellido', u.apellido);
        else            sessionStorage.removeItem('apellido');
        this.initiales = this.calcularInitiales();
        setTimeout(() => this.exitoPerfil = false, 3000);
      },
      error: (e) => {
        this.guardandoPerfil = false;
        this.errorPerfil = e?.error?.message ?? e?.error?.detail ?? 'No se pudo guardar el perfil.';
      }
    });
  }

  guardarPreferencias(): void {
    const pref = this.preferenciasForm.getRawValue();
    const actual = loadPreferenciasUsuario();
    savePreferenciasUsuario({
      ...actual,
      avatarStyle: pref.avatarStyle,
      fraseHome: pref.fraseHome,
    });
    this.exitoPreferencias = true;
    this.actualizarFrasePreview();
    window.dispatchEvent(new CustomEvent('ra-preferencias-updated'));
    setTimeout(() => this.exitoPreferencias = false, 2500);
  }

  restaurarPreferencias(): void {
    this.preferenciasForm.patchValue({
      avatarStyle: RA_PREFS_DEFAULT.avatarStyle,
      fraseHome: RA_PREFS_DEFAULT.fraseHome,
    });
    this.guardarPreferencias();
  }

  actualizarFrasePreview(): void {
    this.frasePreview = fraseHomeByMode(this.preferenciasForm.controls.fraseHome.value, this.nombreUsuario);
  }

  verOtraFrase(): void {
    const seed = `${this.nombreUsuario}|${Date.now()}|${Math.random()}`;
    this.frasePreview = fraseHomeByMode(this.preferenciasForm.controls.fraseHome.value, seed);
  }

  get avatarColorPreview(): string {
    return avatarColorByStyle(this.preferenciasForm.controls.avatarStyle.value);
  }

  get avatarPreviewImage(): string | null {
    return avatarImageByStyle(this.preferenciasForm.controls.avatarStyle.value);
  }

  get nombreCompleto(): string {
    const n = (sessionStorage.getItem('nombre')   ?? '').trim();
    const a = (sessionStorage.getItem('apellido') ?? '').trim();
    return [n, a].filter(Boolean).join(' ') || this.nombreUsuario;
  }

  get textoAccesoRapido(): string {
    return this.rolKey === 'admin'
      ? 'Ir al panel de administracion'
      : 'Ir a registro de asistencia';
  }

  irAccesoRapido(): void {
    if (this.rolKey === 'admin') {
      this.router.navigate(['/pages/admin/estadisticas']);
      return;
    }
    this.router.navigate(['/pages/asistencia']);
  }

  private calcularInitiales(): string {
    const n = (sessionStorage.getItem('nombre')   ?? '').trim();
    const a = (sessionStorage.getItem('apellido') ?? '').trim();
    if (n && a) return (n[0] + a[0]).toUpperCase();
    if (n)      return n.substring(0, 2).toUpperCase();
    return (sessionStorage.getItem('username') ?? 'U').substring(0, 2).toUpperCase();
  }

  private detectarRolKey(): 'admin' | 'gerente' | 'recepcionista' | '' {
    try {
      const token = sessionStorage.getItem(environment.TOKEN_NAME) ?? '';
      if (!token) return '';
      const d: any = this.jwt.decodeToken(token);
      const roles: string[] = [
        ...(Array.isArray(d?.roles)       ? d.roles       : []),
        ...(Array.isArray(d?.authorities) ? d.authorities : []),
        ...(Array.isArray(d?.realm_access?.roles) ? d.realm_access.roles : []),
        ...[d?.role, d?.rol].filter(Boolean),
      ].map((r) => String(r).replace('ROLE_', '').toLowerCase());

      if (d?.is_admin === true || roles.includes('admin')) return 'admin';
      if (roles.includes('gerente')) return 'gerente';
      if (roles.includes('recepcionista')) return 'recepcionista';
      return '';
    } catch { return ''; }
  }

  private labelRol(rol: 'admin' | 'gerente' | 'recepcionista' | ''): string {
    if (rol === 'admin') return 'Administrador';
    if (rol === 'gerente') return 'Gerente';
    if (rol === 'recepcionista') return 'Recepcionista';
    return '';
  }

  private cargarPreferencias(): void {
    const p = loadPreferenciasUsuario();
    this.preferenciasForm.patchValue({
      avatarStyle: p.avatarStyle,
      fraseHome: p.fraseHome,
    });
    this.actualizarFrasePreview();
  }
}
