import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PayBand } from 'src/app/infrastructure/types/compensation';
import { bandMidpoint, bandPosition, bandStanding, compaRatio, formatMoney } from 'src/app/shared/functions/pay';

/**
 * Where a salary sits in its pay band: a track from the band minimum to the
 * maximum, the midpoint marked, and the salary as a dot. The same facts are
 * written out beside it, so nothing depends on seeing the dot.
 */
@Component({
  selector: 'app-band-meter',
  template: `
    <div class="track" role="img" [attr.aria-label]="label()">
      <span class="mid" aria-hidden="true"></span>
      <span class="dot" [class.is-off]="standing() !== 'within'" [style.left.%]="position()" aria-hidden="true"></span>
    </div>
    @if (!compact()) {
      <div class="ends" aria-hidden="true">
        <span>{{ money(band().min) }}</span>
        <span>{{ money(mid()) }}</span>
        <span>{{ money(band().max) }}</span>
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--acme-space-1); min-width: 7rem; }
    .track {
      position: relative;
      height: 8px;
      margin: 4px 0;
      border-radius: var(--acme-radius-full);
      background: var(--acme-color-surface-hover);
    }
    .mid {
      position: absolute;
      left: 50%;
      top: -3px;
      bottom: -3px;
      width: 2px;
      transform: translateX(-1px);
      background: var(--acme-color-text-subtle);
    }
    .dot {
      position: absolute;
      top: 50%;
      width: 14px;
      height: 14px;
      border: 2px solid var(--acme-color-surface-raised);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: var(--acme-color-data-highlight);
      box-shadow: 0 0 0 1px var(--acme-color-data-highlight);
    }
    .dot.is-off { background: var(--acme-color-warning); box-shadow: 0 0 0 1px var(--acme-color-warning); }
    .ends {
      display: flex;
      justify-content: space-between;
      font-size: var(--acme-text-xs);
      color: var(--acme-color-text-subtle);
      font-variant-numeric: tabular-nums;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BandMeterComponent {
  salary = input.required<number>();
  band = input.required<PayBand>();
  /** Track only, for table rows. */
  compact = input(false);

  readonly mid = computed(() => bandMidpoint(this.band()));
  readonly position = computed(() => bandPosition(this.salary(), this.band()));
  readonly standing = computed(() => bandStanding(this.salary(), this.band()));
  readonly label = computed(() => {
    const b = this.band();
    const where = { below: 'below the band', within: 'within the band', above: 'above the band' }[this.standing()];
    return `${this.money(this.salary())}, ${where} of ${this.money(b.min)} to ${this.money(b.max)}. ` +
      `Compa-ratio ${compaRatio(this.salary(), b).toFixed(2)}.`;
  });

  money(amount: number) {
    return formatMoney(amount, this.band().currency);
  }
}
