import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FooterComponent } from './footer.component';

/** Centered card layout for the signed-out pages. */
@Component({
  selector: 'app-auth-layout',
  template: `
    <div class="auth">
      <main class="auth-main">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">H</span>
          <span>HRMS</span>
        </div>
        <section class="card auth-card">
          <h1>{{ heading() }}</h1>
          @if (subheading()) {
            <p class="muted">{{ subheading() }}</p>
          }
          <ng-content />
        </section>
        <ng-content select="[after-card]" />
      </main>
      <app-footer />
    </div>
  `,
  styles: `
    .auth {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }
    .auth-main {
      flex: 1;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 1.25rem;
      padding: 2rem 1rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.35rem;
      font-weight: 700;
    }
    .brand-mark {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 8px;
      background: var(--brand);
      color: var(--brand-text);
    }
    .auth-card {
      width: min(100%, 26rem);
      display: grid;
      gap: 1rem;
      padding: 1.75rem;
    }
  `,
  imports: [FooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  heading = input.required<string>();
  subheading = input('');
}
