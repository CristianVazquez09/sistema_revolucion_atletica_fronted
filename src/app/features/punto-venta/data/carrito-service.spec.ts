import { TestBed } from '@angular/core/testing';
import { CarritoService } from './carrito-service';

describe('CarritoService', () => {
  let carrito: CarritoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    carrito = TestBed.inject(CarritoService);
    carrito.limpiar();
  });

  it('inicia vacío, sin selección y con total 0', () => {
    expect(carrito.obtenerItems()).toEqual([]);
    expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
    expect(carrito.obtenerTotal()).toBe(0);
  });

  describe('agregar', () => {
    it('agrega un producto nuevo y lo selecciona', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      expect(carrito.obtenerItems()).toEqual([
        { idProducto: 1, nombre: 'Agua', cantidad: 2, precioUnit: 20 },
      ]);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
    });

    it('acumula cantidad si el producto ya está y lo re-selecciona', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      carrito.agregar(2, 'Proteína', 500, 1);
      carrito.agregar(1, 'Agua', 20, 3);
      expect(carrito.obtenerItems()[0].cantidad).toBe(5);
      expect(carrito.obtenerItems().length).toBe(2);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
    });

    it('ignora cantidades <= 0', () => {
      carrito.agregar(1, 'Agua', 20, 0);
      carrito.agregar(1, 'Agua', 20, -5);
      expect(carrito.obtenerItems()).toEqual([]);
    });
  });

  describe('totalSig', () => {
    it('calcula la suma de cantidad * precioUnit', () => {
      carrito.agregar(1, 'Agua', 20, 2);      // 40
      carrito.agregar(2, 'Proteína', 500, 1); // 500
      expect(carrito.obtenerTotal()).toBe(540);
    });
  });

  describe('cantidadEnCarrito', () => {
    it('devuelve la cantidad del producto o 0', () => {
      carrito.agregar(1, 'Agua', 20, 3);
      expect(carrito.cantidadEnCarrito(1)).toBe(3);
      expect(carrito.cantidadEnCarrito(99)).toBe(0);
    });
  });

  describe('seleccionarIndice', () => {
    it('acepta índices válidos y null', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.agregar(2, 'Proteína', 500, 1);
      carrito.seleccionarIndice(0);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
      carrito.seleccionarIndice(null);
      expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
    });

    it('ignora índices fuera de rango', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.seleccionarIndice(5);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0); // sigue el auto-seleccionado por agregar
      carrito.seleccionarIndice(-1);
      expect(carrito.obtenerIndiceSeleccionado()).toBe(0);
    });
  });

  describe('sumarSeleccionado / restarSeleccionado', () => {
    it('suma 1 al seleccionado', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.sumarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(2);
    });

    it('resta 1 pero nunca baja de 1', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      carrito.restarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(1);
      carrito.restarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(1);
    });

    it('sin selección no hacen nada', () => {
      carrito.agregar(1, 'Agua', 20, 2);
      carrito.seleccionarIndice(null);
      carrito.sumarSeleccionado();
      carrito.restarSeleccionado();
      expect(carrito.obtenerItems()[0].cantidad).toBe(2);
    });
  });

  describe('eliminarSeleccionado', () => {
    it('elimina el item y limpia la selección', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.agregar(2, 'Proteína', 500, 1);
      carrito.seleccionarIndice(0);
      carrito.eliminarSeleccionado();
      expect(carrito.obtenerItems().length).toBe(1);
      expect(carrito.obtenerItems()[0].idProducto).toBe(2);
      expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
    });
  });

  describe('limpiar', () => {
    it('vacía items y selección', () => {
      carrito.agregar(1, 'Agua', 20, 1);
      carrito.limpiar();
      expect(carrito.obtenerItems()).toEqual([]);
      expect(carrito.obtenerIndiceSeleccionado()).toBeNull();
      expect(carrito.obtenerTotal()).toBe(0);
    });
  });
});
