import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type BarListItem = { label: string; value: number; link?: string | unknown[]; query?: Record<string, string> };

/**
 * Single-series horizontal bar chart. Every bar carries its value label, so the
 * list doubles as the table view and needs no legend.
 */
@Component({
  selector: 'app-bar-list',
  template: `
    <ul class="bars" [attr.aria-label]="label()">
      @for (item of items(); track item.label) {
        <li [title]="item.label + ': ' + item.value + unit()">
          @if (item.link) {
            <a class="label" [routerLink]="item.link" [queryParams]="item.query">{{ item.label }}</a>
          } @else {
            <span class="label">{{ item.label }}</span>
          }
          <span class="track">
            <span class="bar" [style.flex-basis.%]="(item.value / max()) * 88"></span>
            <span class="value">{{ item.value }}{{ unit() }}</span>
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    .bars {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--acme-space-2) var(--acme-space-4);
    }
    li {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      align-items: center;
      padding: var(--acme-space-1) 0;
    }
    .label {
      font-size: var(--acme-text-sm);
      color: var(--acme-color-text-muted);
      text-decoration: none;
    }
    a.label:hover { color: var(--acme-color-link); text-decoration: underline; }
    .track {
      display: flex;
      align-items: center;
      gap: var(--acme-space-2);
      min-height: 20px;
    }
    /* Slate carries the data; Cobalt is reserved for the one takeaway. */
    .bar {
      flex: 0 0 0;
      min-width: 2px;
      height: 10px;
      border-radius: var(--acme-radius-full);
      background: var(--acme-color-data);
    }
    .value {
      font-size: var(--acme-text-sm);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--acme-color-text);
    }
  `,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarListComponent {
  items = input.required<BarListItem[]>();
  label = input('');
  /** Appended to each value label, e.g. '%'. */
  unit = input('');
  /** Fixed top of the scale (e.g. 100 for percentages); defaults to the largest value. */
  scaleMax = input<number | undefined>(undefined);
  max = computed(() => this.scaleMax() ?? Math.max(1, ...this.items().map((item) => item.value)));
}
