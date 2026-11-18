import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { PermissionsService } from 'src/app/services/permissions.service';

/**
 * People, Projects and Compensation share one destination in the app bar (the
 * ACME bar holds at most five), so their pages carry these underline tabs to
 * move between them. Compensation is there for people who can see others'
 * pay; everyone else with a People record gets their own pay instead.
 */
@Component({
  selector: 'app-people-sections',
  template: `
    <nav class="tabs" aria-label="People sections">
      <a class="tab" routerLink="/employees" routerLinkActive="is-active" ariaCurrentWhenActive="page">People</a>
      <a class="tab" routerLink="/work/projects" routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Projects</a>
      @if (canViewPay()) {
        <a class="tab" routerLink="/compensation" routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Compensation</a>
      } @else if (ownId(); as id) {
        <a class="tab" [routerLink]="['/compensation', id]" routerLinkActive="is-active" ariaCurrentWhenActive="page">Your pay</a>
      }
    </nav>
  `,
  styles: `:host { display: block; }`,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleSectionsComponent {
  readonly canViewPay = inject(PermissionsService).can('ViewCompensation');
  private readonly user = inject(AuthService).currentUser;
  readonly ownId = computed(() => this.user()?.employeeId);
}
