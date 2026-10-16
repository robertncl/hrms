import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Static content page (terms, privacy, cookies), filled from route data. */
@Component({
  selector: 'app-info-page',
  template: `
    <div class="page">
      <div class="page-header">
        <h1>{{ heading() }}</h1>
      </div>
      <section class="card prose">
        <p>{{ body() }}</p>
        <p class="muted">
          ACME People is a demo here: every person, project and request is fictional, and the
          changes you make are stored only in this browser.
        </p>
      </section>
    </div>
  `,
  styles: `.prose { display: grid; gap: var(--acme-space-3); max-width: 70ch; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoPageComponent {
  heading = input('');
  body = input('');
}
