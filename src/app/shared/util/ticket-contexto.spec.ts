import { obtenerNombreCajero, crearContextoTicket } from './ticket-contexto';
import { GimnasioData } from '../../shared/models/gimnasio-data';

describe('ticket-contexto', () => {
  describe('obtenerNombreCajero', () => {
    beforeEach(() => sessionStorage.clear());
    afterEach(() => sessionStorage.clear());

    it('prioriza "nombre apellido" del sessionStorage', () => {
      sessionStorage.setItem('nombre', 'Ana');
      sessionStorage.setItem('apellido', 'García');
      sessionStorage.setItem('username', 'anag');
      expect(obtenerNombreCajero()).toBe('Ana García');
    });

    it('usa solo el nombre si no hay apellido', () => {
      sessionStorage.setItem('nombre', 'Ana');
      expect(obtenerNombreCajero()).toBe('Ana');
    });

    it('cae al username si no hay nombre ni apellido', () => {
      sessionStorage.setItem('username', 'anag');
      expect(obtenerNombreCajero()).toBe('anag');
    });

    it('cae al fallback si sessionStorage está vacío', () => {
      expect(obtenerNombreCajero('Recepción')).toBe('Recepción');
    });

    it('sin nada devuelve "Cajero"', () => {
      expect(obtenerNombreCajero()).toBe('Cajero');
    });

    it('ignora espacios en blanco', () => {
      sessionStorage.setItem('nombre', '   ');
      sessionStorage.setItem('username', '  anag  ');
      expect(obtenerNombreCajero()).toBe('anag');
    });
  });

  describe('crearContextoTicket', () => {
    it('con gimnasio arma el contexto completo', () => {
      const gym = {
        idGimnasio: 1,
        nombre: 'RA Centro',
        direccion: 'Av. Principal 123',
        telefono: '5512345678',
      } as GimnasioData;

      const ctx = crearContextoTicket(gym, 'Ana García');

      expect(ctx.negocio.nombre).toBe('RA Centro');
      expect(ctx.negocio.direccion).toBe('Av. Principal 123');
      expect(ctx.negocio.telefono).toBe('5512345678');
      expect(ctx.cajero).toBe('Ana García');
      expect(ctx.leyendaLateral).toBe('RA Centro');
      expect(ctx.brandTitle).toBe('REVOLUCIÓN ATLÉTICA');
    });

    it('con gimnasio null usa los defaults', () => {
      const ctx = crearContextoTicket(null, 'Cajero');
      expect(ctx.negocio.nombre).toBe('Tu gimnasio');
      expect(ctx.negocio.direccion).toBe('');
      expect(ctx.negocio.telefono).toBe('');
      expect(ctx.leyendaLateral).toBe('Tu gimnasio');
    });
  });
});
