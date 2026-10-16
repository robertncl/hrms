import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  template: `
    <div class="page">
      <section class="card missing">
        <h1>Page not found</h1>
        <p class="muted">That page doesn't exist, or it has moved.</p>
        <a class="btn btn-primary" routerLink="/dashboard">Go to Home</a>
      </section>
    </div>
  `,
  styles: `.missing { display: grid; gap: var(--acme-space-3); justify-items: center; padding: var(--acme-space-12) var(--acme-space-4); text-align: center; }`,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
