export type AvatarStyle =
  | 'azul'
  | 'verde'
  | 'rojo'
  | 'morado'
  | 'sticker_rayo'
  | 'sticker_cohete'
  | 'sticker_estrella'
  | 'sticker_fuego';
export type FraseHomeMode = 'clasica' | 'motivar' | 'divertida';

export interface PreferenciasUsuario {
  avatarStyle: AvatarStyle;
  fraseHome: FraseHomeMode;
}

export const RA_PREFS_KEY = 'ra_user_preferences_v1';

export const RA_PREFS_DEFAULT: PreferenciasUsuario = {
  avatarStyle: 'azul',
  fraseHome: 'clasica',
};

export function loadPreferenciasUsuario(): PreferenciasUsuario {
  try {
    const raw = localStorage.getItem(RA_PREFS_KEY);
    if (!raw) return { ...RA_PREFS_DEFAULT };
    const parsed = JSON.parse(raw ?? '{}') as Partial<PreferenciasUsuario>;
    return sanitizePreferencias(parsed);
  } catch {
    return { ...RA_PREFS_DEFAULT };
  }
}

export function savePreferenciasUsuario(preferencias: PreferenciasUsuario): void {
  const clean = sanitizePreferencias(preferencias);
  localStorage.setItem(RA_PREFS_KEY, JSON.stringify(clean));
}

export function avatarColorByStyle(style: AvatarStyle): string {
  const map: Record<AvatarStyle, string> = {
    azul: '#0B2C4A',
    verde: '#0E943F',
    rojo: '#C1121F',
    morado: '#6D28D9',
    sticker_rayo: '#0ea5e9',
    sticker_cohete: '#9333ea',
    sticker_estrella: '#0f766e',
    sticker_fuego: '#dc2626',
  };
  return map[style];
}

export function avatarImageByStyle(style: AvatarStyle): string | null {
  const map: Partial<Record<AvatarStyle, string>> = {
    sticker_rayo: 'avatares/sticker-rayo.svg',
    sticker_cohete: 'avatares/sticker-cohete.svg',
    sticker_estrella: 'avatares/sticker-estrella.svg',
    sticker_fuego: 'avatares/sticker-fuego.svg',
  };
  return map[style] ?? null;
}

export function fraseHomeByMode(mode: FraseHomeMode, seed = ''): string {
  const frases: Record<FraseHomeMode, string[]> = {
    clasica: [
      'Esfuerzate y se valiente',
      'Constancia hoy, resultados manana',
      'Disciplina en cada repeticion',
    ],
    motivar: [
      'Una mejora pequena todos los dias',
      'No compitas con nadie, supera tu version de ayer',
      'La energia de hoy construye tu meta',
    ],
    divertida: [
      'Hoy toca entrenar, no negociar con la silla',
      'Si sudas, cuenta doble',
      'Modo gimnasio: activado',
    ],
  };

  const pool = frases[mode] ?? frases.clasica;
  const key = `${new Date().toISOString().slice(0, 10)}|${seed}|${mode}`;
  const idx = stableHash(key) % pool.length;
  return pool[idx];
}

function sanitizePreferencias(input: Partial<PreferenciasUsuario>): PreferenciasUsuario {
  return {
    avatarStyle: sanitizeAvatar(input.avatarStyle),
    fraseHome: sanitizeFraseMode(input.fraseHome),
  };
}

function sanitizeAvatar(value: unknown): AvatarStyle {
  return value === 'azul'
    || value === 'verde'
    || value === 'rojo'
    || value === 'morado'
    || value === 'sticker_rayo'
    || value === 'sticker_cohete'
    || value === 'sticker_estrella'
    || value === 'sticker_fuego'
    ? value
    : RA_PREFS_DEFAULT.avatarStyle;
}

function sanitizeFraseMode(value: unknown): FraseHomeMode {
  return value === 'clasica' || value === 'motivar' || value === 'divertida'
    ? value
    : RA_PREFS_DEFAULT.fraseHome;
}

function stableHash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) - h) + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
