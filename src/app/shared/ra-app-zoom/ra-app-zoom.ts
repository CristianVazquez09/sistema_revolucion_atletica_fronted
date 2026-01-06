import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

type ZoomCfg = {
  designWidth: number;
  minZoom: number;
  maxZoom: number;
  offset: number;
  minHeight: number;
};

@Component({
  selector: 'ra-app-zoom',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #outer class="overflow-x-hidden min-h-[100dvh] bg-ra-bg">
      <div
        class="origin-top-left overflow-x-hidden"
        [style.zoom]="zoom()"
        [style.minHeight.px]="innerMinHpx()"
        [style.--ra-zoom]="zoom()"
        [style.--ra-maxh]="maxH()"
      >
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class RaAppZoomComponent implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private ar = inject(ActivatedRoute);

  @ViewChild('outer', { static: true }) outer!: ElementRef<HTMLElement>;

  @Input() defaultDesignWidth = 1650;
  @Input() defaultOffset = 310;

  private cfg: ZoomCfg = {
    designWidth: 1650,
    minZoom: 0.67,
    maxZoom: 1,
    offset: 310,
    minHeight: 420,
  };

  zoom = signal(1);
  maxH = signal('650px');
  innerMinHpx = signal(0);

  private ro?: ResizeObserver;

  private clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private readDeepestRouteData(): Partial<ZoomCfg> {
    let r: ActivatedRoute = this.ar;
    while (r.firstChild) r = r.firstChild;
    return (r.snapshot.data || {}) as Partial<ZoomCfg>;
  }

  private applyCfgFromRoute = () => {
    const d = this.readDeepestRouteData();
    this.cfg = {
      designWidth: d.designWidth ?? this.defaultDesignWidth,
      offset: d.offset ?? this.defaultOffset,
      minZoom: d.minZoom ?? 0.67,
      maxZoom: d.maxZoom ?? 1,
      minHeight: d.minHeight ?? 420,
    };
    this.recalc();
  };

  private recalc = () => {
    const outerEl = this.outer?.nativeElement;

    const w = outerEl?.clientWidth || 1;
    const h = outerEl?.clientHeight || window.innerHeight;

    const z = this.clamp(w / this.cfg.designWidth, this.cfg.minZoom, this.cfg.maxZoom);
    const zz = this.round2(z);
    this.zoom.set(zz);

    // 1) Compensación de alto del layout (quita el bloque blanco)
    //    Queremos que el alto visible sea ~h; como se escala por zz,
    //    el alto “real” debe ser h/zz.
    this.innerMinHpx.set(Math.ceil(h / zz));

    // 2) Max height para scrollers (si los usas en tablas)
    const available = window.innerHeight - this.cfg.offset;
    const compensated = Math.floor(available / zz);
    const finalH = Math.max(this.cfg.minHeight, compensated);
    this.maxH.set(`${finalH}px`);
  };

  ngAfterViewInit(): void {
    this.applyCfgFromRoute();

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.applyCfgFromRoute());

    this.ro = new ResizeObserver(() => this.recalc());
    this.ro.observe(this.outer.nativeElement);

    window.addEventListener('resize', this.recalc);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    window.removeEventListener('resize', this.recalc);
  }
}
