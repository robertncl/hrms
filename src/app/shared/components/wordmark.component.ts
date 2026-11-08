import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The ACME wordmark, as the design system's Wordmark component draws it: a
 * Signal Red rounded square (corner radius 0.3 × its height) with an upright
 * white "A", then ACME in Inter 700 uppercase at 12% tracking. The classes
 * come from styles/acme.css.
 *
 * The brand mark is CSS-only by design: the design system ships no logo file
 * and forbids drawing a substitute, recolouring or italicising it.
 */
@Component({
  selector: 'app-wordmark',
  template: `
    <span class="acme-wordmark">
      <span class="acme-wordmark__mark" aria-hidden="true">A</span>ACME
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    /* 15px keeps the mark at 24px, above the 20px minimum. */
    .acme-wordmark { font-size: 15px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordmarkComponent {}
