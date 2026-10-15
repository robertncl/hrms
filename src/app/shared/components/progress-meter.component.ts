import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Horizontal progress meter with its percentage shown as text, so it never relies on colour alone. */
@Component({
  selector: 'app-progress-meter',
  template: `
    <span class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100"
      [attr.aria-valuenow]="clamped()" [attr.aria-label]="label() || null">
      <span class="fill" [style.width.%]="clamped()"></span>
    </span>
    <span class="value">{{ clamped() }}%</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      min-width: 7rem;
    }
    .meter {
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: var(--meter-track);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: var(--series-1);
    }
    .value {
      min-width: 2.75rem;
      text-align: end;
      font-size: 0.85rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressMeterComponent {
  value = input.required<number>();
  label = input('');
  clamped = computed(() => Math.min(100, Math.max(0, Math.round(this.value()))));
}
