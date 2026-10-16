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
        <p class="alert alert-info">
          Trying the demo? Sign in as
          @for (account of demoAccounts; track account.email; let last = $last) {
            <button class="use" type="button" (click)="useAccount(account.email)">{{ account.email }}</button
            >{{ last ? '' : ' or ' }}
          }
          with the password <strong>{{ demoPassword }}</strong>.
        </p>
      }
    </app-auth-layout>
    `,
  styles: `
    .auth-form { display: grid; gap: var(--acme-space-4); }
    .field input { min-height: 2.75rem; }
    .btn-block { width: 100%; min-height: 2.75rem; font-size: var(--acme-text-md); }

    /* The demo addresses are the fastest way in, so make them clickable
       rather than something to retype. */
    .use {
      border: 0;
      padding: 0;
      background: none;
      color: inherit;
      font-family: inherit;
      font-size: inherit;
      font-weight: 600;
      text-decoration: underline;
      cursor: pointer;
    }
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
