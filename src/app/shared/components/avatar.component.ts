import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Profile picture, or slate initials when there is none.
 *
 * Initials are deliberately not tinted per person: ACME rations Cobalt, and a
 * per-name hue would scatter colour across every list. Away people get the
 * danger wash, which always travels with a text status beside it.
 */
@Component({
  selector: 'app-avatar',
  template: `
    <span class="avatar" [class.is-away]="away()" [style.--size]="size()" aria-hidden="true">
      @if (src()) {
        <img [src]="src()" alt="" />
      } @else {
        {{ initials() }}
      }
    </span>
  `,
  styles: `:host { display: inline-flex; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  name = input.required<string>();
  src = input<string | undefined>('');
  size = input('2rem');
  away = input(false);

  initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );
}
