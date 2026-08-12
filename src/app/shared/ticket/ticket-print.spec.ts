import { TestBed } from '@angular/core/testing';
import { TicketPrintService } from './ticket-print';

describe('TicketPrintService', () => {
  let service: TicketPrintService;
  const html = '<html><body onload="window.print();window.close();">hola</body></html>';

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TicketPrintService);
    localStorage.clear();
    delete (window as any).electron;
  });

  afterEach(() => {
    delete (window as any).electron;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('abrirYImprimir', () => {
    it('should delegate to electron.printTicket when available, without opening a window', () => {
      const printTicket = jasmine.createSpy('printTicket').and.resolveTo(undefined);
      (window as any).electron = { printTicket };
      const openSpy = spyOn(window, 'open');

      service.abrirYImprimir(html, 'ticket-1.html');

      expect(printTicket).toHaveBeenCalledTimes(1);
      const [sentHtml, printerName] = printTicket.calls.first().args;
      expect(sentHtml).not.toContain('onload="window.print();window.close();"');
      expect(printerName).toBeUndefined();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('should pass the saved printer name from localStorage to electron.printTicket', () => {
      localStorage.setItem('ra_printer_name', 'EPSON-TM88');
      const printTicket = jasmine.createSpy('printTicket').and.resolveTo(undefined);
      (window as any).electron = { printTicket };

      service.abrirYImprimir(html, 'ticket-1.html');

      expect(printTicket.calls.first().args[1]).toBe('EPSON-TM88');
    });

    it('should log an error when electron.printTicket rejects', async () => {
      const printTicket = jasmine.createSpy('printTicket').and.rejectWith(new Error('boom'));
      (window as any).electron = { printTicket };
      const errorSpy = spyOn(console, 'error');

      service.abrirYImprimir(html, 'ticket-1.html');
      await Promise.resolve().then().then(); // deja que el catch se procese

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should open a popup, write the sanitized html and print when electron is unavailable', () => {
      const fakeWin = {
        document: {
          open: jasmine.createSpy('open'),
          write: jasmine.createSpy('write'),
          close: jasmine.createSpy('close'),
          readyState: 'complete',
        },
        focus: jasmine.createSpy('focus'),
        print: jasmine.createSpy('print'),
        close: jasmine.createSpy('close'),
        addEventListener: jasmine.createSpy('addEventListener'),
      };
      spyOn(window, 'open').and.returnValue(fakeWin as any);

      jasmine.clock().install();
      service.abrirYImprimir(html, 'ticket-1.html');
      jasmine.clock().tick(150);
      jasmine.clock().uninstall();

      expect(fakeWin.document.write).toHaveBeenCalled();
      const written = fakeWin.document.write.calls.first().args[0];
      expect(written).not.toContain('onload="window.print();window.close();"');
      expect(fakeWin.print).toHaveBeenCalled();
    });

    it('should fall back to download when the popup is blocked', () => {
      spyOn(window, 'open').and.returnValue(null);
      const descargarSpy = spyOn(service, 'descargarHtml');

      service.abrirYImprimir(html, 'ticket-1.html');

      expect(descargarSpy).toHaveBeenCalledWith('ticket-1.html', jasmine.any(String));
    });
  });

  describe('verComoHtml', () => {
    it('should add data-debug="1" to <body> by default', () => {
      const fakeWin = {
        document: {
          open: jasmine.createSpy(),
          write: jasmine.createSpy(),
          close: jasmine.createSpy(),
        },
      };
      spyOn(window, 'open').and.returnValue(fakeWin as any);

      service.verComoHtml(html, 'ticket-preview.html');

      const written = fakeWin.document.write.calls.first().args[0];
      expect(written).toContain('data-debug="1"');
      expect(written).not.toContain('onload="window.print();window.close();"');
    });

    it('should NOT add data-debug when debug=false (comportamiento de verCorteComoHtml)', () => {
      const fakeWin = {
        document: {
          open: jasmine.createSpy(),
          write: jasmine.createSpy(),
          close: jasmine.createSpy(),
        },
      };
      spyOn(window, 'open').and.returnValue(fakeWin as any);

      service.verComoHtml(html, 'ticket-corte.html', false);

      const written = fakeWin.document.write.calls.first().args[0];
      expect(written).not.toContain('data-debug="1"');
    });

    it('should fall back to download when the popup is blocked', () => {
      spyOn(window, 'open').and.returnValue(null);
      const descargarSpy = spyOn(service, 'descargarHtml');

      service.verComoHtml(html, 'ticket-preview.html');

      expect(descargarSpy).toHaveBeenCalledWith('ticket-preview.html', jasmine.any(String));
    });
  });

  describe('descargarHtml', () => {
    it('should create a Blob, trigger a download link and revoke the object URL', () => {
      const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:fake-url');
      const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
      const clickSpy = jasmine.createSpy('click');
      const fakeAnchor = { href: '', download: '', click: clickSpy, remove: jasmine.createSpy() };
      spyOn(document, 'createElement').and.returnValue(fakeAnchor as any);
      spyOn(document.body, 'appendChild').and.callFake((n: any) => n);

      service.descargarHtml('ticket-x.html', '<html></html>');

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(fakeAnchor.download).toBe('ticket-x.html');
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:fake-url');
    });

    it('should default to "ticket.html" when nombre is empty', () => {
      spyOn(URL, 'createObjectURL').and.returnValue('blob:fake-url');
      spyOn(URL, 'revokeObjectURL');
      const fakeAnchor = {
        href: '',
        download: '',
        click: jasmine.createSpy(),
        remove: jasmine.createSpy(),
      };
      spyOn(document, 'createElement').and.returnValue(fakeAnchor as any);
      spyOn(document.body, 'appendChild').and.callFake((n: any) => n);

      service.descargarHtml('', '<html></html>');

      expect(fakeAnchor.download).toBe('ticket.html');
    });
  });
});
