import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  template: `
    <section class="card empty-state">
      <h1>Page not found</h1>
      <p>The page you are looking for doesn't exist or has moved.</p>
      <p><a class="btn btn-primary" routerLink="/dashboard">Go to the dashboard</a></p>
    </section>
  `,
  styles: `.empty-state { display: grid; gap: 0.75rem; justify-items: center; padding: 3rem 1rem; }`,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
