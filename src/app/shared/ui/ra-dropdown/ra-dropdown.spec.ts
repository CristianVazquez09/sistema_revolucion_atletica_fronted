import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RaDropdown } from './ra-dropdown';

@Component({
  standalone: true,
  imports: [RaDropdown],
  template: `
    <ra-dropdown>
      <button class="item-a">A</button>
    </ra-dropdown>
    <ra-dropdown>
      <button class="item-b">B</button>
    </ra-dropdown>
  `,
})
class HostDosDropdowns {}

describe('RaDropdown', () => {
  let fixture: ComponentFixture<HostDosDropdowns>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostDosDropdowns] });
    fixture = TestBed.createComponent(HostDosDropdowns);
    fixture.detectChanges();
  });

  function botones(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button[title]'));
  }

  function panelesAbiertos(): number {
    return fixture.nativeElement.querySelectorAll('.item-a, .item-b').length === 0
      ? 0
      : fixture.nativeElement.querySelectorAll('div.fixed').length;
  }

  it('abre el menu al hacer click en el boton', () => {
    botones()[0].click();
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(1);
  });

  it('abrir el segundo cierra el primero (solo uno a la vez)', () => {
    botones()[0].click();
    fixture.detectChanges();
    botones()[1].click();
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(1);
    expect(fixture.nativeElement.querySelector('.item-b')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.item-a')).toBeNull();
  });

  it('click de nuevo en el mismo boton lo cierra', () => {
    botones()[0].click();
    fixture.detectChanges();
    botones()[0].click();
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(0);
  });

  it('click en document cierra el abierto', () => {
    botones()[0].click();
    fixture.detectChanges();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(panelesAbiertos()).toBe(0);
  });
});
