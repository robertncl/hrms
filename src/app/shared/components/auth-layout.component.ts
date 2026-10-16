import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WordmarkComponent } from './wordmark.component';

/**
 * Split layout for the signed-out pages: the form on the left, and a navy
 * panel on the right carrying the product promise over a photograph.
 *
 * The panel is the one dark surface in a light-only system, so nothing on it
 * keys off a light-page token — the kicker is pinned to blue-200, which clears
 * contrast on blue-900 where the page's accent would not.
 */
@Component({
  selector: 'app-auth-layout',
  template: `
    <div class="auth">
      <main class="form-side">
        <app-wordmark />
        <div class="form-body">
          <div>
            <h1>{{ heading() }}</h1>
            @if (subheading()) {
              <p>{{ subheading() }}</p>
            }
          </div>
          <ng-content />
        </div>
        <span class="legal">&copy; ACME Corp. Since 1949, and still not liable for the anvils.</span>
      </main>

      <aside class="promo">
        <img src="assets/images/golden-gate-bridge.jpg" alt="" />
        <div class="promo-body">
          <span class="promo-kicker">ACME People</span>
          <p>{{ promo() }}</p>
        </div>
      </aside>
    </div>
  `,
  styles: `
    .auth {
      min-height: 100dvh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--acme-color-canvas);
    }

    .form-side {
      display: flex;
      flex-direction: column;
      /* Keeps the brand, form and legal line apart when the form is taller
         than the screen and the auto margins below collapse to nothing. */
      gap: var(--acme-space-8);
      padding: var(--acme-space-12) var(--acme-space-16);
    }

    .form-body {
      margin: auto 0;
      width: 100%;
      max-width: 400px;
      display: grid;
      gap: var(--acme-space-6);
    }
    .form-body h1 { margin: 0; }
    .form-body > div > p {
      margin-top: var(--acme-space-2);
      font-size: var(--acme-text-md);
      color: var(--acme-color-text-muted);
    }

    .legal { font-size: var(--acme-text-xs); color: var(--acme-color-text-subtle); }

    .promo {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: var(--acme-space-16);
      overflow: hidden;
      background: var(--acme-blue-900);
      color: var(--acme-gray-0);
    }
    .promo img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.45;
    }

    /* The photograph alone cannot guarantee contrast for the kicker and
       headline, and AA is a design-system non-negotiable. This is the same
       navy scrim the project hero uses. */
    .promo::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgb(10 17 30 / 0.1), rgb(10 17 30 / 0.72));
    }

    .promo-body { position: relative; z-index: 1; max-width: 460px; }
    .promo-kicker {
      display: block;
      margin-bottom: var(--acme-space-3);
      font: 600 var(--acme-text-xs) / 1.2 var(--acme-font-sans);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      /* Pinned: the page accent would sit at ~2.2:1 on this navy. */
      color: var(--acme-blue-200);
    }
    .promo-body p {
      margin: 0;
      font: 700 var(--acme-text-3xl) / 1.25 var(--acme-font-display);
    }

    @media (max-width: 960px) {
      .auth { grid-template-columns: minmax(0, 1fr); }
      .form-side { padding: var(--acme-space-8) var(--acme-space-5); }
      /* The promo is reassurance, not content — it goes last on a phone. */
      .promo { padding: var(--acme-space-8) var(--acme-space-5); min-height: 14rem; }
      .promo-body p { font-size: var(--acme-text-xl); }
    }
  `,
  imports: [WordmarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  heading = input.required<string>();
  subheading = input('');
  promo = input(
    'Every request, interview and course in one place — so Mondays start with decisions, not digging.',
  );
}
