import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Profile picture, or coloured initials when there is none. */
@Component({
  selector: 'app-avatar',
  template: `
    <span class="avatar" [style.--hue]="hue()" [style.--size]="size()" aria-hidden="true">
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
  size = input('2.25rem');

  initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  // Stable hue per name so the same person always gets the same colour.
  hue = computed(() => [...this.name()].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 7));
}
