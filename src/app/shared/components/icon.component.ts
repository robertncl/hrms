import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'home'
  | 'users'
  | 'briefcase'
  | 'calendar'
  | 'user-plus'
  | 'bell'
  | 'log-out'
  | 'refresh'
  | 'search'
  | 'plus'
  | 'arrow-left'
  | 'check';

/** Small stroke icons (Feather-style), decorative unless given a label. */
@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name()) {
        @case ('home') {
          <svg:path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <svg:polyline points="9 22 9 12 15 12 15 22" />
        }
        @case ('users') {
          <svg:path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <svg:circle cx="9" cy="7" r="4" />
          <svg:path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <svg:path d="M16 3.13a4 4 0 0 1 0 7.75" />
        }
        @case ('briefcase') {
          <svg:rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <svg:path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        }
        @case ('calendar') {
          <svg:rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <svg:line x1="16" y1="2" x2="16" y2="6" />
          <svg:line x1="8" y1="2" x2="8" y2="6" />
          <svg:line x1="3" y1="10" x2="21" y2="10" />
        }
        @case ('user-plus') {
          <svg:path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <svg:circle cx="8.5" cy="7" r="4" />
          <svg:line x1="20" y1="8" x2="20" y2="14" />
          <svg:line x1="23" y1="11" x2="17" y2="11" />
        }
        @case ('bell') {
          <svg:path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <svg:path d="M13.73 21a2 2 0 0 1-3.46 0" />
        }
        @case ('log-out') {
          <svg:path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <svg:polyline points="16 17 21 12 16 7" />
          <svg:line x1="21" y1="12" x2="9" y2="12" />
        }
        @case ('refresh') {
          <svg:polyline points="23 4 23 10 17 10" />
          <svg:path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        }
        @case ('search') {
          <svg:circle cx="11" cy="11" r="8" />
          <svg:line x1="21" y1="21" x2="16.65" y2="16.65" />
        }
        @case ('plus') {
          <svg:line x1="12" y1="5" x2="12" y2="19" />
          <svg:line x1="5" y1="12" x2="19" y2="12" />
        }
        @case ('arrow-left') {
          <svg:line x1="19" y1="12" x2="5" y2="12" />
          <svg:polyline points="12 19 5 12 12 5" />
        }
        @case ('check') {
          <svg:polyline points="20 6 9 17 4 12" />
        }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  name = input.required<IconName>();
  size = input(18);
}
