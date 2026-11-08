import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * People and Projects share one destination in the app bar (the ACME bar
 * holds at most five), so the two list pages carry these underline tabs to
 * move between them.
 */
@Component({
  selector: 'app-people-sections',
  template: `
    <nav class="tabs" aria-label="People sections">
      <a class="tab" routerLink="/employees" routerLinkActive="is-active" ariaCurrentWhenActive="page">People</a>
      <a class="tab" routerLink="/work/projects" routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Projects</a>
    </nav>
  `,
  styles: `:host { display: block; }`,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleSectionsComponent {}
