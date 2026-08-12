import {
  TicketItem,
  TicketPagoDetalle,
  VentaBackend,
  calcularSubtotal,
  docId,
  escape,
  htmlCorte,
  htmlMembresia,
  htmlVenta,
  normalizarItemsDesdeBackend,
  normalizarPagosVentaDesdeBackend,
  normalizeMetodoPago,
  pagoLabelCorto,
  pickNum,
  renderBloquePagos,
  sumarEfectivo,
  sumarPagosPorMetodo,
  sumarPorOrigen,
  money,
  toInt,
  toNum,
} from './ticket-html';

describe('ticket-html (funciones puras)', () => {
  describe('Helpers', () => {
    describe('money: formato de moneda mexicana', () => {
      it('should format 1500 as $1,500.00', () => {
        expect(money(1500)).toBe('$1,500.00');
      });

      it('should format 0 as $0.00', () => {
        expect(money(0)).toBe('$0.00');
      });

      it('should format NaN as $0.00', () => {
        expect(money(NaN)).toBe('$0.00');
      });

      it('should format 100.5 as $100.50', () => {
        expect(money(100.5)).toBe('$100.50');
      });

      it('should format large numbers with thousands separator', () => {
        expect(money(12345.67)).toBe('$12,345.67');
      });
    });

    describe('escape: HTML entity encoding', () => {
      it('should escape <a>&" and single quote', () => {
        expect(escape('<a>&"')).toBe('&lt;a&gt;&amp;&quot;');
      });

      it('should escape single quote as &#39;', () => {
        expect(escape("'")).toBe('&#39;');
      });

      it('should return empty string for null', () => {
        expect(escape(null as any)).toBe('');
      });

      it('should escape all special chars in combination', () => {
        expect(escape('<script>alert("xss")</script>')).toBe(
          '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
        );
      });
    });

    describe('toNum: conversión a número', () => {
      it('should convert "12.5" to 12.5', () => {
        expect(toNum('12.5')).toBe(12.5);
      });

      it('should convert "x" to 0', () => {
        expect(toNum('x')).toBe(0);
      });

      it('should convert null to 0', () => {
        expect(toNum(null)).toBe(0);
      });

      it('should pass through number unchanged', () => {
        expect(toNum(42)).toBe(42);
      });

      it('should convert negative numbers', () => {
        expect(toNum('-5.5')).toBe(-5.5);
      });
    });

    describe('toInt: conversión a entero (sin floor para numeric input)', () => {
      it('should convert "3.9" to 3 via parseInt', () => {
        expect(toInt('3.9')).toBe(3);
      });

      it('should convert "x" to 0', () => {
        expect(toInt('x')).toBe(0);
      });

      it('should pass numeric input 2.7 through without floor', () => {
        // Numeric input bypasses parseInt and is returned as-is
        expect(toInt(2.7)).toBe(2.7);
      });

      it('should pass numeric 0 through', () => {
        expect(toInt(0)).toBe(0);
      });

      it('should convert string integers correctly', () => {
        expect(toInt('42')).toBe(42);
      });
    });

    describe('pickNum: preferencia con fallback', () => {
      it('should return fallback when prefer is 0', () => {
        expect(pickNum(0, 5)).toBe(5);
      });

      it('should return prefer when prefer is 3', () => {
        expect(pickNum(3, 5)).toBe(3);
      });

      it('should return fallback when prefer is -1', () => {
        expect(pickNum(-1, 5)).toBe(5);
      });

      it('should return fallback when prefer is NaN', () => {
        expect(pickNum(NaN, 5)).toBe(5);
      });

      it('should return prefer when prefer is positive', () => {
        expect(pickNum(0.1, 10)).toBe(0.1);
      });
    });

    describe('calcularSubtotal: suma de items', () => {
      it('should return 100 for single item qty 2 × price 50', () => {
        const items: TicketItem[] = [{ nombre: 'X', cantidad: 2, precioUnit: 50 }];
        expect(calcularSubtotal(items)).toBe(100);
      });

      it('should return 0 for empty array', () => {
        expect(calcularSubtotal([])).toBe(0);
      });

      it('should sum multiple items', () => {
        const items: TicketItem[] = [
          { nombre: 'A', cantidad: 2, precioUnit: 50 },
          { nombre: 'B', cantidad: 1, precioUnit: 30 },
        ];
        expect(calcularSubtotal(items)).toBe(130);
      });

      it('should handle string quantities and prices', () => {
        const items: TicketItem[] = [{ nombre: 'X', cantidad: '3', precioUnit: '25' }];
        expect(calcularSubtotal(items)).toBe(75);
      });
    });

    describe('normalizarItemsDesdeBackend: mapeo de detalles backend', () => {
      it('should map detail with precioVenta correctly', () => {
        const venta: VentaBackend = {
          detalles: [{ cantidad: 2, producto: { nombre: 'X', precioVenta: 10 } }],
        };
        const result = normalizarItemsDesdeBackend(venta);
        expect(result).toEqual([{ nombre: 'X', cantidad: 2, precioUnit: 10 }]);
      });

      it('should return empty array for no detalles', () => {
        const venta: VentaBackend = {};
        const result = normalizarItemsDesdeBackend(venta);
        expect(result).toEqual([]);
      });

      it('should calculate precioUnit from subTotal and cantidad when precioVenta missing', () => {
        const venta: VentaBackend = {
          detalles: [{ cantidad: 2, subTotal: 30, producto: { nombre: 'Y' } }],
        };
        const result = normalizarItemsDesdeBackend(venta);
        expect(result[0].precioUnit).toBe(15);
      });

      it('should use fallback nombre when product name missing', () => {
        const venta: VentaBackend = {
          detalles: [{ cantidad: 1, producto: { precioVenta: 100 } }],
        };
        const result = normalizarItemsDesdeBackend(venta);
        expect(result[0].nombre).toBe('—');
      });
    });

    describe('normalizarPagosVentaDesdeBackend: mapeo de pagos backend', () => {
      it('should map pagos with tipoPago and monto', () => {
        const venta: VentaBackend = {
          pagos: [{ tipoPago: 'EFECTIVO', monto: 100 }],
        };
        const result = normalizarPagosVentaDesdeBackend(venta);
        expect(result).toEqual([{ metodo: 'EFECTIVO', monto: 100 }]);
      });

      it('should return undefined for empty pagos array', () => {
        const venta: VentaBackend = { pagos: [] };
        const result = normalizarPagosVentaDesdeBackend(venta);
        expect(result).toBeUndefined();
      });

      it('should filter out payments with monto <= 0', () => {
        const venta: VentaBackend = {
          pagos: [
            { tipoPago: 'EFECTIVO', monto: 100 },
            { tipoPago: 'TARJETA', monto: 0 },
            { tipoPago: 'SPEI', monto: -50 },
          ],
        };
        const result = normalizarPagosVentaDesdeBackend(venta);
        expect(result).toEqual([{ metodo: 'EFECTIVO', monto: 100 }]);
      });

      it('should use metodo as fallback when tipoPago missing', () => {
        const venta: VentaBackend = {
          pagos: [{ metodo: 'TARJETA', monto: 50 }],
        };
        const result = normalizarPagosVentaDesdeBackend(venta);
        expect(result).toEqual([{ metodo: 'TARJETA', monto: 50 }]);
      });
    });

    describe('normalizeMetodoPago: normalización de métodos de pago', () => {
      it('should normalize "Crédito" to TARJETA', () => {
        expect(normalizeMetodoPago('Crédito')).toBe('TARJETA');
      });

      it('should normalize "SPEI" to TRANSFERENCIA', () => {
        expect(normalizeMetodoPago('SPEI')).toBe('TRANSFERENCIA');
      });

      it('should normalize "cortesía" to OTRO', () => {
        expect(normalizeMetodoPago('cortesía')).toBe('OTRO');
      });

      it('should return EFECTIVO for "EFECTIVO"', () => {
        expect(normalizeMetodoPago('EFECTIVO')).toBe('EFECTIVO');
      });

      it('should normalize "Cash" to EFECTIVO', () => {
        expect(normalizeMetodoPago('Cash')).toBe('EFECTIVO');
      });

      it('should normalize "Débito" to TARJETA', () => {
        expect(normalizeMetodoPago('Débito')).toBe('TARJETA');
      });

      it('should normalize "Deposito" to TRANSFERENCIA', () => {
        expect(normalizeMetodoPago('Deposito')).toBe('TRANSFERENCIA');
      });

      it('should handle spaces and dashes in input', () => {
        expect(normalizeMetodoPago('Tarjeta - Crédito')).toBe('TARJETA');
      });
    });

    describe('sumarPagosPorMetodo: agregación por método', () => {
      it('should sum payments by method into 4 buckets', () => {
        const arr = [
          { tipoPago: 'EFECTIVO', total: 100 },
          { tipoPago: 'TARJETA', total: 200 },
          { tipoPago: 'SPEI', total: 50 },
          { tipoPago: 'Otro', total: 30 },
        ];
        const result = sumarPagosPorMetodo(arr);
        expect(result).toEqual({
          EFECTIVO: 100,
          TARJETA: 200,
          TRANSFERENCIA: 50,
          OTRO: 30,
        });
      });

      it('should handle multiple items per bucket', () => {
        const arr = [
          { tipoPago: 'EFECTIVO', total: 50 },
          { tipoPago: 'Efectivo', total: 50 },
          { tipoPago: 'TARJETA', total: 30 },
        ];
        const result = sumarPagosPorMetodo(arr);
        expect(result).toEqual({
          EFECTIVO: 100,
          TARJETA: 30,
          TRANSFERENCIA: 0,
          OTRO: 0,
        });
      });

      it('should initialize all buckets even if empty', () => {
        const arr: any[] = [];
        const result = sumarPagosPorMetodo(arr);
        expect(result!.EFECTIVO).toBeDefined();
        expect(result!.TARJETA).toBeDefined();
        expect(result!.TRANSFERENCIA).toBeDefined();
        expect(result!.OTRO).toBeDefined();
      });
    });

    describe('sumarPorOrigen: suma por origen (case-insensitive)', () => {
      it('should sum VENTA items', () => {
        const arr = [
          { origen: 'VENTA', total: 30 },
          { origen: 'VENTA', total: 20 },
        ];
        const result = sumarPorOrigen('VENTA', arr);
        expect(result).toBe(50);
      });

      it('should be case-insensitive', () => {
        const arr = [{ origen: 'venta', total: 30 }];
        const result = sumarPorOrigen('VENTA', arr);
        expect(result).toBe(30);
      });

      it('should ignore items with different origen', () => {
        const arr = [
          { origen: 'VENTA', total: 30 },
          { origen: 'MEMBRESIA', total: 20 },
        ];
        const result = sumarPorOrigen('VENTA', arr);
        expect(result).toBe(30);
      });

      it('should return 0 for empty array', () => {
        const result = sumarPorOrigen('VENTA', []);
        expect(result).toBe(0);
      });
    });

    describe('sumarEfectivo: suma de efectivo', () => {
      it('should sum EFECTIVO payments', () => {
        const arr = [
          { tipoPago: 'Efectivo', total: 40 },
          { tipoPago: 'Tarjeta', total: 10 },
        ];
        const result = sumarEfectivo(arr);
        expect(result).toBe(40);
      });

      it('should handle multiple EFECTIVO items', () => {
        const arr = [
          { tipoPago: 'EFECTIVO', total: 30 },
          { tipoPago: 'Efectivo', total: 20 },
          { tipoPago: 'TARJETA', total: 50 },
        ];
        const result = sumarEfectivo(arr);
        expect(result).toBe(50);
      });

      it('should return 0 when no EFECTIVO', () => {
        const arr = [{ tipoPago: 'TARJETA', total: 100 }];
        const result = sumarEfectivo(arr);
        expect(result).toBe(0);
      });
    });

    describe('docId: generador de ID grande', () => {
      it('should return HTML containing FOLIO and 123', () => {
        const result = docId('FOLIO', 123);
        expect(result).toContain('FOLIO');
        expect(result).toContain('123');
        expect(result).toContain('doc-id');
      });

      it('should return empty string for empty folio', () => {
        const result = docId('FOLIO', '');
        expect(result).toBe('');
      });

      it('should escape special characters in folio', () => {
        const result = docId('FOLIO', '<script>');
        expect(result).toContain('&lt;script&gt;');
      });

      it('should handle null label', () => {
        const result = docId(null, 456);
        expect(result).toContain('456');
        expect(result).not.toContain('lbl');
      });
    });

    describe('pagoLabelCorto: labels cortos de pago', () => {
      it('should shorten EFECTIVO to EFEC', () => {
        expect(pagoLabelCorto('EFECTIVO')).toBe('EFEC');
      });

      it('should shorten Transferencia to TRASF', () => {
        expect(pagoLabelCorto('Transferencia')).toBe('TRASF');
      });

      it('should shorten TARJETA to TARJ', () => {
        expect(pagoLabelCorto('TARJETA')).toBe('TARJ');
      });

      it('should handle SPEI label', () => {
        expect(pagoLabelCorto('SPEI')).toBe('SPEI');
      });

      it('should truncate to 6 chars for unrecognized methods', () => {
        expect(pagoLabelCorto('Cash')).toBe('CASH');
      });
    });

    describe('renderBloquePagos: bloque de pagos HTML', () => {
      it('should contain section title when provided', () => {
        const pagos: TicketPagoDetalle[] = [{ metodo: 'EFECTIVO', monto: 100 }];
        const result = renderBloquePagos(undefined, pagos, undefined, 'PAGOS');
        expect(result).toContain('PAGOS');
      });

      it('should contain EFECTIVO method with formatted amount', () => {
        const pagos: TicketPagoDetalle[] = [{ metodo: 'EFECTIVO', monto: 100 }];
        const result = renderBloquePagos(undefined, pagos, 100, 'PAGOS');
        expect(result).toContain('EFECTIVO');
        expect(result).toContain('$100.00');
      });

      it('should render multiple payment methods', () => {
        const pagos: TicketPagoDetalle[] = [
          { metodo: 'EFECTIVO', monto: 60 },
          { metodo: 'TARJETA', monto: 40 },
        ];
        const result = renderBloquePagos(undefined, pagos, undefined, 'PAGOS');
        expect(result).toContain('EFECTIVO');
        expect(result).toContain('TARJETA');
        expect(result).toContain('$60.00');
        expect(result).toContain('$40.00');
      });

      it('should filter out payments with monto <= 0', () => {
        const pagos: TicketPagoDetalle[] = [
          { metodo: 'EFECTIVO', monto: 100 },
          { metodo: 'TARJETA', monto: 0 },
        ];
        const result = renderBloquePagos(undefined, pagos, undefined, 'PAGOS');
        expect(result).toContain('EFECTIVO');
        expect(result).not.toContain('TARJETA');
      });

      it('should return empty string when no pagos and no tipoPago', () => {
        const result = renderBloquePagos(undefined, [], undefined, 'PAGOS');
        expect(result).toBe('');
      });

      it('should use tipoPago fallback when no pagos', () => {
        const result = renderBloquePagos('EFECTIVO', [], 100, 'PAGOS');
        expect(result).toContain('EFECTIVO');
        expect(result).toContain('$100.00');
      });
    });
  });

  describe('HTML Builders', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    describe('htmlVenta: generador de HTML para tickets de venta', () => {
      it('should contain negocio nombre in uppercase', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Mi Gimnasio' },
          folio: '1001',
          fecha: new Date('2026-01-15T10:30:00Z'),
          cajero: 'Juan',
          items: [{ nombre: 'Proteína', cantidad: 2, precioUnit: 500 }],
          totales: { total: 1000 },
        });
        expect(html).toContain('MI GIMNASIO');
      });

      it('should contain folio number', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '5042',
          fecha: new Date('2026-01-15T10:30:00Z'),
          items: [{ nombre: 'Item', cantidad: 1, precioUnit: 100 }],
          totales: { total: 100 },
        });
        expect(html).toContain('5042');
      });

      it('should contain quantity marker x2 for item with cantidad=2', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          items: [{ nombre: 'Proteína', cantidad: 2, precioUnit: 500 }],
          totales: { total: 1000 },
        });
        expect(html).toContain('x2');
      });

      it('should contain formatted total in money format', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          items: [{ nombre: 'Item', cantidad: 1, precioUnit: 1500 }],
          totales: { total: 1500 },
        });
        expect(html).toContain('$1,500.00');
      });

      it('should contain CAJERO: label with cajero name', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          cajero: 'Carlos López',
          items: [],
          totales: { total: 0 },
        });
        expect(html).toContain('CAJERO:');
        expect(html).toContain('Carlos López');
      });

      it('should contain ¡Gracias por su compra! footer', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          items: [],
          totales: { total: 0 },
        });
        expect(html).toContain('¡Gracias por su compra!');
      });

      it('should contain ESTE NO ES UN COMPROBANTE FISCAL disclaimer', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          items: [],
          totales: { total: 0 },
        });
        expect(html).toContain('ESTE NO ES UN COMPROBANTE FISCAL');
      });

      it('should escape HTML in item nombre to prevent injection', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          items: [{ nombre: '<script>alert(1)</script>', cantidad: 1, precioUnit: 100 }],
          totales: { total: 100 },
        });
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>alert');
      });
    });

    describe('htmlMembresia: generador de HTML para tickets de membresía', () => {
      it('should contain concepto', () => {
        const html = htmlMembresia({
          negocio: { nombre: 'Gym' },
          folio: '2001',
          fecha: new Date(),
          concepto: 'Membresía MENSUAL',
          importe: 500,
          total: 500,
          totalAPagar: 500,
          estado: 'PAGADO',
        });
        expect(html).toContain('Membresía MENSUAL');
      });

      it('should contain TOTAL A PAGAR label', () => {
        const html = htmlMembresia({
          negocio: { nombre: 'Gym' },
          folio: '2001',
          fecha: new Date(),
          concepto: 'Membresía',
          importe: 500,
          total: 500,
          totalAPagar: 500,
        });
        expect(html).toContain('TOTAL A PAGAR');
      });

      it('should contain *** PAGADO *** when estado=PAGADO', () => {
        const html = htmlMembresia({
          negocio: { nombre: 'Gym' },
          folio: '2001',
          fecha: new Date(),
          concepto: 'Membresía',
          importe: 500,
          total: 500,
          totalAPagar: 500,
          estado: 'PAGADO',
        });
        expect(html).toContain('*** PAGADO ***');
      });

      it('should contain ENTRENADOR: label when entrenador is provided', () => {
        const html = htmlMembresia({
          negocio: { nombre: 'Gym' },
          folio: '2001',
          fecha: new Date(),
          concepto: 'Membresía',
          importe: 500,
          total: 500,
          totalAPagar: 500,
          entrenador: 'Miguel Santos',
        });
        expect(html).toContain('ENTRENADOR:');
        expect(html).toContain('Miguel Santos');
      });

      it('should NOT contain ENTRENADOR: label when entrenador is not provided', () => {
        const html = htmlMembresia({
          negocio: { nombre: 'Gym' },
          folio: '2001',
          fecha: new Date(),
          concepto: 'Membresía',
          importe: 500,
          total: 500,
          totalAPagar: 500,
        });
        expect(html).not.toContain('ENTRENADOR:');
      });

      it('should contain formatted total in money format', () => {
        const html = htmlMembresia({
          negocio: { nombre: 'Gym' },
          folio: '2001',
          fecha: new Date(),
          concepto: 'Membresía',
          importe: 2500,
          total: 2500,
          totalAPagar: 2500,
        });
        expect(html).toContain('$2,500.00');
      });
    });

    describe('htmlCorte: generador de HTML para corte de caja', () => {
      it('should contain ::: CORTE DE CAJA ::: banner', () => {
        const html = htmlCorte(
          {
            negocio: { nombre: 'Gym' },
            folio: 'C001',
            fecha: new Date(),
            totales: { general: 5000 },
          },
          'REVOLUCIÓN ATLÉTICA',
        );
        expect(html).toContain('::: CORTE DE CAJA :::');
      });

      it('should contain CORTE # with idCorte value', () => {
        const html = htmlCorte(
          {
            negocio: { nombre: 'Gym' },
            folio: '999',
            idCorte: '999',
            fecha: new Date(),
            totales: { general: 5000 },
          },
          'REVOLUCIÓN ATLÉTICA',
        );
        expect(html).toContain('CORTE # 999');
      });

      it('should contain TIPOS DE INGRESOS section', () => {
        const html = htmlCorte(
          {
            negocio: { nombre: 'Gym' },
            folio: '1',
            fecha: new Date(),
            totales: { ventas: 1000, membresias: 500, accesorias: 200, general: 1700 },
          },
          'REVOLUCIÓN ATLÉTICA',
        );
        expect(html).toContain('TIPOS DE INGRESOS');
      });

      it('should contain FORMAS DE PAGO section', () => {
        const html = htmlCorte(
          {
            negocio: { nombre: 'Gym' },
            folio: '1',
            fecha: new Date(),
            totales: { general: 1000 },
            pagos: { EFECTIVO: 1000 },
          },
          'REVOLUCIÓN ATLÉTICA',
        );
        expect(html).toContain('FORMAS DE PAGO');
      });

      it('should contain formatted total.general in money format', () => {
        const html = htmlCorte(
          {
            negocio: { nombre: 'Gym' },
            folio: '1',
            fecha: new Date(),
            totales: { general: 3500 },
          },
          'REVOLUCIÓN ATLÉTICA',
        );
        expect(html).toContain('$3,500.00');
      });

      it('should contain brand title in uppercase', () => {
        const html = htmlCorte(
          {
            negocio: { nombre: 'Gym' },
            folio: '1',
            fecha: new Date(),
            totales: { general: 1000 },
          },
          'Mi Marca Fitness',
        );
        expect(html).toContain('MI MARCA FITNESS');
      });

      it('should contain negocio nombre in uppercase', () => {
        const html = htmlCorte(
          {
            negocio: { nombre: 'Sucursal Centro' },
            folio: '1',
            fecha: new Date(),
            totales: { general: 1000 },
          },
          'REVOLUCIÓN ATLÉTICA',
        );
        expect(html).toContain('SUCURSAL CENTRO');
      });
    });

    describe('htmlVenta: escape and injection prevention', () => {
      it('should escape <script> tag in item nombre', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          items: [{ nombre: '<script>alert(1)</script>', cantidad: 1, precioUnit: 100 }],
          totales: { total: 100 },
        });
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>alert');
      });

      it('should escape ampersand in item nombre', () => {
        const html = htmlVenta({
          negocio: { nombre: 'Gym' },
          folio: '1',
          fecha: new Date(),
          items: [{ nombre: 'Café & Proteína', cantidad: 1, precioUnit: 100 }],
          totales: { total: 100 },
        });
        expect(html).toContain('&amp;');
      });
    });
  });
});
