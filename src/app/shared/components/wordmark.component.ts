import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The ACME wordmark: a Cobalt square with an italic white "A", then ACME in
 * uppercase with wide tracking, then the product name in sentence case.
 *
 * The brand mark is CSS-only by design — the design system ships no logo file
 * and forbids drawing a substitute.
 */
@Component({
  selector: 'app-wordmark',
  template: `
    <span class="wordmark">
      <span class="mark" aria-hidden="true">A</span>
      <span class="name">ACME</span>
      <span class="product">People</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .wordmark {
      display: inline-flex;
      align-items: center;
      gap: var(--acme-space-2);
      font: 700 15px var(--acme-font-sans);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--acme-color-text);
    }
    .mark {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      flex: none;
      border-radius: var(--acme-radius-sm);
      background: var(--acme-color-primary);
      color: var(--acme-color-on-primary);
      font-size: 13px;
      font-style: italic;
      letter-spacing: 0;
    }
    .name { letter-spacing: inherit; }
    .product {
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      color: var(--acme-color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordmarkComponent {}
