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
          This HRMS instance is a demo: all people, projects and requests are fictional, and every
          change you make is stored only in this browser.
        </p>
      </section>
    </div>
  `,
  styles: `.prose { display: grid; gap: 0.75rem; max-width: 70ch; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoPageComponent {
  heading = input('');
  body = input('');
}
