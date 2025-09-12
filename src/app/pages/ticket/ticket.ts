import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket.html',
  styleUrl: './ticket.css',
})
export class Ticket {
  @ViewChild('ticket',{ static: false }) ticketRef!: ElementRef<HTMLDivElement>;

  // Ejemplo de datos (adáptalo a tu venta real)
  negocio = { nombre: 'Revolución Atlética', rfc: 'XAXX010101000' };
  folio = 'V-000123';
  fecha = new Date();
  items = [
    { nombre: 'Pree entreno Psycotyc', cantidad: 1, precio: 650.00 },
    { nombre: 'Agua 600ml', cantidad: 2, precio: 15.00 },
  ];
  get subtotal()   { return this.items.reduce((a,i)=>a + i.cantidad*i.precio, 0); }
  get total()      { return this.subtotal; }

  imprimir() {
    // Abre una ventana temporal aislada con el HTML del ticket + estilos
    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket</title>
  <style>
    /* Copiamos estilos críticos del ticket.css (ver abajo) */
    html,body { margin:0; padding:0; }
    .ticket   { width: 80mm; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .title    { text-align:center; font-weight:700; margin-bottom: 6px; }
    .muted    { opacity:.8 }
    .hr       { border-top:1px dashed #000; margin:6px 0; }
    .row      { display:flex; justify-content:space-between; }
    .right    { text-align:right }
    @page { size: 80mm auto; margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body onload="window.print(); window.close();">
${this.ticketRef.nativeElement.outerHTML}
</body></html>`;

    const popup = window.open('', '_blank', 'width=380,height=600,noopener,noreferrer');
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
}
