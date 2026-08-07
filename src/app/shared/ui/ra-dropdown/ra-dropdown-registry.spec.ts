import { TestBed } from '@angular/core/testing';
import { RaDropdownRegistry } from './ra-dropdown-registry';

describe('RaDropdownRegistry', () => {
  let registry: RaDropdownRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(RaDropdownRegistry);
  });

  it('no tiene nada abierto al inicio', () => {
    expect(registry.estaAbierto(Symbol('x'))).toBeFalse();
  });

  it('abrir marca ese id como abierto', () => {
    const id = Symbol('a');
    registry.abrir(id);
    expect(registry.estaAbierto(id)).toBeTrue();
  });

  it('abrir uno cierra el anterior', () => {
    const idA = Symbol('a');
    const idB = Symbol('b');
    registry.abrir(idA);
    registry.abrir(idB);
    expect(registry.estaAbierto(idA)).toBeFalse();
    expect(registry.estaAbierto(idB)).toBeTrue();
  });

  it('cerrarTodos cierra el que estuviera abierto', () => {
    const id = Symbol('a');
    registry.abrir(id);
    registry.cerrarTodos();
    expect(registry.estaAbierto(id)).toBeFalse();
  });
});
