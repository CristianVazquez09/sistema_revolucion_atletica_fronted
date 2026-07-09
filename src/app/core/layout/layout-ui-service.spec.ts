import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout-ui-service';

describe('LayoutService', () => {
  let service: LayoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LayoutService);
  });

  it('should have sidebarOpen initially false', () => {
    expect(service.sidebarOpen()).toBe(false);
  });

  it('should open sidebar when calling open()', () => {
    service.open();
    expect(service.sidebarOpen()).toBe(true);
  });

  it('should close sidebar when calling close()', () => {
    service.sidebarOpen.set(true);
    service.close();
    expect(service.sidebarOpen()).toBe(false);
  });

  it('should toggle sidebar state when calling toggle()', () => {
    expect(service.sidebarOpen()).toBe(false);
    service.toggle();
    expect(service.sidebarOpen()).toBe(true);
    service.toggle();
    expect(service.sidebarOpen()).toBe(false);
  });
});
