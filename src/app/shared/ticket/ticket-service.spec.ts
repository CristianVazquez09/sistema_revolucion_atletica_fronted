import { TestBed } from '@angular/core/testing';
import { TicketService } from './ticket-service';
import { TicketPrintService } from './ticket-print';
import { VentaBackend, VentaContexto } from './ticket-html';

describe('TicketService (orquestador)', () => {
  let service: TicketService;
  let print: jasmine.SpyObj<TicketPrintService>;

  const ctx: VentaContexto = { negocio: { nombre: 'Gym' }, cajero: 'Juan' };

  beforeEach(() => {
    const printSpy = jasmine.createSpyObj<TicketPrintService>('TicketPrintService', [
      'abrirYImprimir',
      'verComoHtml',
      'descargarHtml',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: TicketPrintService, useValue: printSpy }],
    });
    service = TestBed.inject(TicketService);
    print = TestBed.inject(TicketPrintService) as jasmine.SpyObj<TicketPrintService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('API base (Sección B)', () => {
    it('imprimirVenta should print two copies of the same html', () => {
      service.imprimirVenta({
        negocio: { nombre: 'Gym' },
        folio: '1',
        fecha: new Date(),
        items: [],
        totales: { total: 0 },
      });

      expect(print.abrirYImprimir).toHaveBeenCalledTimes(2);
      const [html1, nombre1] = print.abrirYImprimir.calls.argsFor(0);
      const [html2] = print.abrirYImprimir.calls.argsFor(1);
      expect(html1).toBe(html2);
      expect(nombre1).toBe('ticket-venta-1.html');
    });

    it('verVentaComoHtml should delegate to print.verComoHtml with the venta html', () => {
      service.verVentaComoHtml({
        negocio: { nombre: 'Gym' },
        folio: '7',
        fecha: new Date(),
        items: [],
        totales: { total: 0 },
      });

      expect(print.verComoHtml).toHaveBeenCalledTimes(1);
      const [html, nombre] = print.verComoHtml.calls.first().args;
      expect(html).toContain('Ticket Venta');
      expect(nombre).toBe('ticket-venta-7.html');
    });

    it('imprimirEntrenador should print only ONE copy (asimetría preexistente respecto a los demás tipos)', () => {
      service.imprimirEntrenador({
        negocio: { nombre: 'Gym' },
        folio: '9',
        fecha: new Date(),
        concepto: 'Sesión',
        importe: 100,
      });

      expect(print.abrirYImprimir).toHaveBeenCalledTimes(1);
    });

    it('imprimirAccesoria should print two copies', () => {
      service.imprimirAccesoria({
        negocio: { nombre: 'Gym' },
        folio: '3',
        fecha: new Date(),
        concepto: 'Asesoría',
        importe: 200,
      });

      expect(print.abrirYImprimir).toHaveBeenCalledTimes(2);
    });
  });

  describe('Alto nivel (Sección A)', () => {
    it('imprimirVentaDesdeBackend should compute subtotal/total from detalles and print', () => {
      const venta: VentaBackend = {
        folio: 100,
        detalles: [{ cantidad: 2, producto: { nombre: 'Proteína', precioVenta: 250 } }],
      };

      service.imprimirVentaDesdeBackend(venta, ctx);

      expect(print.abrirYImprimir).toHaveBeenCalledTimes(2);
      const html = print.abrirYImprimir.calls.first().args[0];
      expect(html).toContain('$500.00');
    });

    it('imprimirVentaDesdeBackend should prefer pagos explícitos over backend-derived pagos', () => {
      const venta: VentaBackend = {
        folio: 100,
        detalles: [{ cantidad: 1, producto: { nombre: 'X', precioVenta: 100 } }],
        pagos: [{ tipoPago: 'TARJETA', monto: 100 }],
      };

      service.imprimirVentaDesdeBackend(venta, ctx, undefined, [
        { metodo: 'EFECTIVO', monto: 100 },
      ]);

      const html = print.abrirYImprimir.calls.first().args[0];
      expect(html).toContain('EFECTIVO');
      expect(html).not.toContain('TARJETA');
    });

    it('verMembresiaDesdeContexto should delegate to verMembresiaComoHtml (a diferencia de imprimirMembresiaDesdeContexto)', () => {
      service.verMembresiaDesdeContexto({
        ctx,
        folio: '55',
        socioNombre: 'Ana',
        paqueteNombre: 'MENSUAL',
        precioPaquete: 500,
        descuento: 50,
        costoInscripcion: 100,
      });

      expect(print.verComoHtml).toHaveBeenCalledTimes(1);
      expect(print.abrirYImprimir).not.toHaveBeenCalled();
      const [html, nombre] = print.verComoHtml.calls.first().args;
      expect(html).toContain('$550.00');
      expect(nombre).toBe('ticket-membresia-55.html');
    });

    it('imprimirMembresiaDesdeContexto should compute total = precio + inscripcion - descuento and print two copies', () => {
      service.imprimirMembresiaDesdeContexto({
        ctx,
        folio: '55',
        socioNombre: 'Ana',
        paqueteNombre: 'MENSUAL',
        precioPaquete: 500,
        descuento: 50,
        costoInscripcion: 100,
      });

      expect(print.abrirYImprimir).toHaveBeenCalledTimes(2);
      const html = print.abrirYImprimir.calls.first().args[0];
      expect(html).toContain('$550.00'); // total a pagar
      expect(html).toContain('Membresía MENSUAL');
    });

    it('imprimirSalidaEfectivo should print two copies', () => {
      service.imprimirSalidaEfectivo({
        negocio: { nombre: 'Gym' },
        folio: '1',
        fecha: new Date(),
        concepto: 'Retiro',
        monto: 200,
      });

      expect(print.abrirYImprimir).toHaveBeenCalledTimes(2);
    });

    it('imprimirCorteDesdeBackend should sum totals por origen y delegar a print.abrirYImprimir', () => {
      service.imprimirCorteDesdeBackend(
        {
          idCorte: 1,
          desgloses: [
            { origen: 'VENTA', tipoPago: 'EFECTIVO', total: 300 },
            { origen: 'MEMBRESIA', tipoPago: 'TARJETA', total: 700 },
          ],
        },
        { negocio: { nombre: 'Gym' } },
      );

      expect(print.abrirYImprimir).toHaveBeenCalledTimes(1);
      const html = print.abrirYImprimir.calls.first().args[0];
      expect(html).toContain('$1,000.00'); // total general
    });

    it('verCorteComoHtml should delegate to print.verComoHtml with debug=false', () => {
      service.verCorteComoHtml({ idCorte: 1, desgloses: [] }, { negocio: { nombre: 'Gym' } });

      expect(print.verComoHtml).toHaveBeenCalledTimes(1);
      const [, , debug] = print.verComoHtml.calls.first().args;
      expect(debug).toBe(false);
    });

    it('imprimirCorteDesdeBackend y verCorteComoHtml deben calcular exactamente los mismos totales', () => {
      const corte = {
        idCorte: 1,
        desgloses: [
          { origen: 'VENTA', tipoPago: 'EFECTIVO', total: 300 },
          { origen: 'ACCESORIA', tipoPago: 'TARJETA', total: 150 },
        ],
      };

      service.imprimirCorteDesdeBackend(corte, { negocio: { nombre: 'Gym' } });
      service.verCorteComoHtml(corte, { negocio: { nombre: 'Gym' } });

      const htmlImprimir = print.abrirYImprimir.calls.first().args[0];
      const htmlVer = print.verComoHtml.calls.first().args[0] as string;
      // Ambos deben contener el mismo total general calculado
      expect(htmlImprimir).toContain('$450.00');
      expect(htmlVer).toContain('$450.00');
    });
  });
});
