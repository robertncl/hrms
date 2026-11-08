import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info';

/**
 * The ACME status glyphs (check, triangle, cross-in-circle, info-in-circle)
 * that the design system builds into Badge and Alert. Drawn on a 24px grid
 * with a round stroke in currentColor, so they take the badge's or alert's
 * status hue and keep the status legible without colour (WCAG 1.4.1).
 */
const PATHS: Record<StatusVariant, string[]> = {
  success: ['M20 6 9 17l-5-5'],
  warning: ['M12 3 2 20h20L12 3z', 'M12 10v4', 'M12 17h.01'],
  danger: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15 9l-6 6', 'M9 9l6 6'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 16v-4', 'M12 8h.01'],
};

@Component({
  selector: 'app-status-icon',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      [attr.stroke-width]="size() <= 12 ? 2.25 : 2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" focusable="false">
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusIconComponent {
  variant = input.required<StatusVariant>();
  size = input(16);

  paths = computed(() => PATHS[this.variant()]);
}
