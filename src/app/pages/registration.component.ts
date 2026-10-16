import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { AuthLayoutComponent } from '../shared/components/auth-layout.component';

@Component({
  selector: 'app-registration',
  template: `
    <app-auth-layout heading="Create your account"
      subheading="Use your ACME email. Your admin sets what you can see.">
      <form class="auth-form" (ngSubmit)="submit()">
        <div class="field">
          <label for="reg-email">Work email</label>
          <input id="reg-email" type="email" name="email" placeholder="you@acme.com"
            autocomplete="email" required [(ngModel)]="credentials.email" />
        </div>
        <div class="field">
          <label for="reg-password">Password</label>
          <input id="reg-password" type="password" name="password" autocomplete="new-password"
            required [(ngModel)]="credentials.password" aria-describedby="reg-password-hint" />
          <span id="reg-password-hint" class="hint">
            At least 8 characters. A passphrase is easier to remember.
          </span>
        </div>
        <div class="field">
          <label for="reg-confirm">Confirm password</label>
          <input id="reg-confirm" type="password" name="confirmPassword" autocomplete="new-password" required
            [attr.aria-invalid]="passwordMismatch" aria-describedby="reg-confirm-error"
            [(ngModel)]="credentials.confirmPassword" />
          @if (passwordMismatch) {
            <span id="reg-confirm-error" class="error-msg">Those two passwords don't match.</span>
          }
        </div>

        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }

        <button class="btn btn-primary btn-block" type="submit" [disabled]="submitting()">
          {{ submitting() ? 'Creating account…' : 'Create account' }}
        </button>
      </form>

      <p class="small muted">
        Already have an account? <a routerLink="/login">Sign in</a>
      </p>
    </app-auth-layout>
  `,
  styles: `
    .auth-form { display: grid; gap: var(--acme-space-4); }
    .field input { min-height: 2.75rem; }
    .btn-block { width: 100%; min-height: 2.75rem; font-size: var(--acme-text-md); }
  `,
  standalone: true,
  imports: [FormsModule, RouterLink, AuthLayoutComponent],
})
export class RegistrationComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  credentials = { email: '', password: '', confirmPassword: '' };
  submitting = signal(false);
  error = signal('');

  get passwordMismatch(): boolean {
    return this.credentials.confirmPassword.length > 0 &&
      this.credentials.password !== this.credentials.confirmPassword;
  }

  submit() {
    if (this.credentials.email && this.credentials.password &&
      this.credentials.password === this.credentials.confirmPassword) {
      const { email, password } = this.credentials;
      this.submitting.set(true);
      this.error.set('');
      // Sign straight in after registering.
      this.authService.register({ email, password }).pipe(
        switchMap(() => this.authService.login({ email, password })),
        finalize(() => this.submitting.set(false)),
      ).subscribe({
        next: () => this.router.navigateByUrl('/dashboard'),
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.message ?? "That didn't work. Try again."),
      });
    }
  }
}
