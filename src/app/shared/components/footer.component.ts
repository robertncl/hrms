import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { isAuth } from '../functions/is-auth';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  template: `
    <footer>
      <div class="about">
        <h2>HRMS</h2>
        <p>Welcome to HRMS platform!</p>
      </div>
      <div class="links">
        Follow us on social media:
        <a href="https://linkedin.com" target="_blank" rel="noopener">Linkedin</a>
        <a href="https://x.com" target="_blank" rel="noopener">X (former Twitter)</a>
      </div>
      @if (isAuth$ | async) {
        <div class="legal">
          <a routerLink="/terms">Terms of Service</a>
          <a routerLink="/privacy">Privacy Policy</a>
          <a routerLink="/cookies">Cookies Policy</a>
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
      gap: 0.75rem 1.5rem;
      padding: 1.25rem 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 0.85rem;
    }
    .about {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
    }
    h2 { font-size: 0.95rem; color: var(--text); }
    .links, .legal {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 0.9rem;
    }
  `,
  standalone: true,
  imports: [AsyncPipe, RouterLink],
})
export class FooterComponent {
  isAuth$ = isAuth();
}
