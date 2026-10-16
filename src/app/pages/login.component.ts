import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AuthLayoutComponent } from '../shared/components/auth-layout.component';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../demo/demo-data';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-login',
  template: `
    <app-auth-layout heading="Welcome back" subheading="Sign in to pick up where you left off.">
      <form class="auth-form" (ngSubmit)="submit()">
        <div class="field">
          <label for="login-email">Work email</label>
          <input id="login-email" type="email" name="email" placeholder="you@acme.com"
            autocomplete="username" required [(ngModel)]="credentials.email" />
        </div>
        <div class="field">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" name="password" autocomplete="current-password"
            required [(ngModel)]="credentials.password" />
        </div>

        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }

        <button class="btn btn-primary btn-block" type="submit"
          [disabled]="submitting() || !credentials.email || !credentials.password">
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="small muted">
        New to ACME People? <a routerLink="/registration">Create an account</a>
      </p>

      @if (demoAccounts.length) {
        <section class="demo" aria-labelledby="demo-title">
          <h2 id="demo-title">Trying the demo?</h2>
          <p class="small muted">
            Each account sees ACME People as a different role. Pick one, then sign in.
            The password is <strong>{{ demoPassword }}</strong> for all of them.
          </p>
          <ul>
            @for (account of demoAccounts; track account.email) {
              <li>
                <button class="use" type="button" [attr.aria-pressed]="credentials.email === account.email"
                  (click)="useAccount(account.email)">
                  <span class="role">{{ account.role }} <span class="who">· {{ account.name }}</span></span>
                  <span class="email">{{ account.email }}</span>
                  <span class="summary">{{ account.summary }}</span>
                </button>
              </li>
            }
          </ul>
        </section>
      }
    </app-auth-layout>
    `,
  styles: `
    .auth-form { display: grid; gap: var(--acme-space-4); }
    .field input { min-height: 2.75rem; }
    .btn-block { width: 100%; min-height: 2.75rem; font-size: var(--acme-text-md); }

    .demo { display: grid; gap: var(--acme-space-2); }
    .demo h2 { margin: 0; font-size: var(--acme-text-md); }
    .demo ul { display: grid; gap: var(--acme-space-2); margin: var(--acme-space-1) 0 0; padding: 0; list-style: none; }

    /* The demo accounts are the fastest way in, so each is one click
       rather than an address to retype. */
    .use {
      display: grid;
      gap: 2px;
      width: 100%;
      padding: var(--acme-space-2) var(--acme-space-3);
      border: 1px solid var(--acme-color-border);
      border-radius: var(--acme-radius-md);
      background: var(--acme-color-surface-raised);
      color: var(--acme-color-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .use:hover { border-color: var(--acme-color-text-subtle); }
    .use[aria-pressed='true'] {
      border: 2px solid var(--acme-color-selected);
      padding: calc(var(--acme-space-2) - 1px) calc(var(--acme-space-3) - 1px);
      background: var(--acme-color-selected-soft);
    }
    .use .role { font-size: var(--acme-text-sm); font-weight: 600; }
    .use .who { font-weight: 400; color: var(--acme-color-text-muted); }
    .use .email { font-size: var(--acme-text-xs); color: var(--acme-color-link); }
    .use .summary { font-size: var(--acme-text-xs); color: var(--acme-color-text-muted); }
  `,
  standalone: true,
  imports: [FormsModule, RouterLink, AuthLayoutComponent],
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  credentials = { email: '', password: '' };
  submitting = signal(false);
  error = signal('');
  readonly demoAccounts = environment.demo ? DEMO_ACCOUNTS : [];
  readonly demoPassword = DEMO_PASSWORD;

  useAccount(email: string) {
    this.credentials = { email, password: DEMO_PASSWORD };
    this.error.set('');
  }

  submit() {
    if (this.credentials.email && this.credentials.password) {
      this.submitting.set(true);
      this.error.set('');
      this.authService.login(this.credentials).pipe(
        finalize(() => this.submitting.set(false)),
      ).subscribe({
        next: () => this.router.navigateByUrl('/dashboard'),
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.message ?? "That didn't work. Check the email and password and try again."),
      });
    }
  }
}
