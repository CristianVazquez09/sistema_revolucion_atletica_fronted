import {
  RA_PREFS_KEY,
  RA_PREFS_DEFAULT,
  AvatarStyle,
  FraseHomeMode,
  PreferenciasUsuario,
  loadPreferenciasUsuario,
  savePreferenciasUsuario,
  avatarColorByStyle,
  avatarImageByStyle,
  fraseHomeByMode,
} from './preferencias-usuario';

describe('Preferencias Usuario', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('loadPreferenciasUsuario()', () => {
    it('should return default object when storage is empty', () => {
      const result = loadPreferenciasUsuario();
      expect(result).toEqual({
        avatarStyle: 'azul',
        fraseHome: 'clasica',
      });
    });

    it('should return default when storage contains corrupt JSON', () => {
      localStorage.setItem(RA_PREFS_KEY, '###');
      const result = loadPreferenciasUsuario();
      expect(result).toEqual({
        avatarStyle: 'azul',
        fraseHome: 'clasica',
      });
    });

    it('should sanitize and return valid values after save + load roundtrip', () => {
      const prefs: PreferenciasUsuario = {
        avatarStyle: 'sticker_rayo',
        fraseHome: 'motivar',
      };
      savePreferenciasUsuario(prefs);
      const loaded = loadPreferenciasUsuario();
      expect(loaded).toEqual(prefs);
    });

    it('should sanitize invalid values and reject extra keys', () => {
      const stored = JSON.stringify({
        avatarStyle: 'neon',
        fraseHome: 'x',
        extra: 1,
      });
      localStorage.setItem(RA_PREFS_KEY, stored);
      const result = loadPreferenciasUsuario();
      expect(result).toEqual({
        avatarStyle: 'azul',
        fraseHome: 'clasica',
      });
    });
  });

  describe('avatarColorByStyle()', () => {
    it('should return correct hex color for rojo', () => {
      expect(avatarColorByStyle('rojo')).toBe('#C1121F');
    });

    it('should return correct hex color for all valid styles', () => {
      const colors: Record<AvatarStyle, string> = {
        azul: '#0B2C4A',
        verde: '#0E943F',
        rojo: '#C1121F',
        morado: '#6D28D9',
        sticker_rayo: '#0ea5e9',
        sticker_cohete: '#9333ea',
        sticker_estrella: '#0f766e',
        sticker_fuego: '#dc2626',
      };

      Object.entries(colors).forEach(([style, expectedColor]) => {
        expect(avatarColorByStyle(style as AvatarStyle)).toBe(expectedColor);
      });
    });
  });

  describe('avatarImageByStyle()', () => {
    it('should return SVG path for sticker_rayo', () => {
      expect(avatarImageByStyle('sticker_rayo')).toBe('avatares/sticker-rayo.svg');
    });

    it('should return null for azul (non-sticker style)', () => {
      expect(avatarImageByStyle('azul')).toBeNull();
    });

    it('should return correct SVG paths for all sticker styles', () => {
      const stickerPaths: Record<string, string> = {
        sticker_rayo: 'avatares/sticker-rayo.svg',
        sticker_cohete: 'avatares/sticker-cohete.svg',
        sticker_estrella: 'avatares/sticker-estrella.svg',
        sticker_fuego: 'avatares/sticker-fuego.svg',
      };

      Object.entries(stickerPaths).forEach(([style, expectedPath]) => {
        expect(avatarImageByStyle(style as AvatarStyle)).toBe(expectedPath);
      });
    });
  });

  describe('fraseHomeByMode()', () => {
    it('should return non-empty string for clasica', () => {
      const frase = fraseHomeByMode('clasica');
      expect(typeof frase).toBe('string');
      expect(frase.length).toBeGreaterThan(0);
    });

    it('should return non-empty string for motivar', () => {
      const frase = fraseHomeByMode('motivar');
      expect(typeof frase).toBe('string');
      expect(frase.length).toBeGreaterThan(0);
    });

    it('should return non-empty string for divertida', () => {
      const frase = fraseHomeByMode('divertida');
      expect(typeof frase).toBe('string');
      expect(frase.length).toBeGreaterThan(0);
    });

    it('should return deterministically same string on same day with same args', () => {
      const mode: FraseHomeMode = 'clasica';
      const seed = 'test-seed';
      const frase1 = fraseHomeByMode(mode, seed);
      const frase2 = fraseHomeByMode(mode, seed);
      expect(frase1).toBe(frase2);
    });

    it('should return deterministically same string across calls for motivar mode', () => {
      const frase1 = fraseHomeByMode('motivar');
      const frase2 = fraseHomeByMode('motivar');
      expect(frase1).toBe(frase2);
    });
  });
});
