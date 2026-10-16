import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isAuth } from '../functions/is-auth';

/**
 * One quiet line at the end of the page.
 *
 * The ACME People screens show no footer, but the legal pages are only
 * reachable from here, so this keeps a hairline-separated row of links rather
 * than orphaning those routes. The old social links are gone: they are off
 * voice for ACME and led nowhere useful.
 */
@Component({
  selector: 'app-footer',
  template: `
    <footer>
      <span class="copyright">&copy; ACME Corp. Since 1949, and still not liable for the anvils.</span>
      @if (isAuth$ | async) {
        <div class="legal">
          <a routerLink="/terms">Terms of service</a>
          <a routerLink="/privacy">Privacy policy</a>
          <a routerLink="/cookies">Cookies policy</a>
        </div>
      }
    </footer>
    `,
  styles: `
    footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--acme-space-2) var(--acme-space-6);
      padding: var(--acme-space-4) var(--acme-space-12);
      border-top: 1px solid var(--app-hairline);
      color: var(--acme-color-text-subtle);
      font-size: var(--acme-text-xs);
    }
    .legal {
      display: flex;
      flex-wrap: wrap;
      gap: var(--acme-space-1) var(--acme-space-4);
    }
    .legal a { color: inherit; text-decoration: none; }
    .legal a:hover { color: var(--acme-color-link); text-decoration: underline; }

    @media (max-width: 860px) {
      footer { padding-inline: var(--acme-space-5); }
    }
  `,
  standalone: true,
  imports: [AsyncPipe, RouterLink],
})
export class FooterComponent {
  isAuth$ = isAuth();
}
