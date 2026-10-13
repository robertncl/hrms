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
        <app-auth-layout heading="Sign in" subheading="Manage your people, projects and hiring in one place.">
          <form class="login-container" (ngSubmit)="submit()">
            <div class="field">
              <label for="login-email">Email</label>
              <input id="login-email" type="email" name="email" placeholder="you@company.com" autocomplete="username" required [(ngModel)]="credentials.email">
            </div>
            <div class="field">
              <label for="login-password">Password</label>
              <input id="login-password" type="password" name="password" placeholder="Password" autocomplete="current-password" required [(ngModel)]="credentials.password">
            </div>
            @if (error()) {
              <p class="alert alert-error" role="alert">{{ error() }}</p>
            }
            @if (!credentials.email || !credentials.password) {
              <span class="warning">
                Please fill in all the required fields
              </span>
            }
            <button class="btn btn-primary" type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Signing in…' : 'Login' }}
            </button>
          </form>
          <p class="muted small">No account? <a routerLink="/registration">Create one</a></p>

          @if (demoAccounts.length) {
            <aside after-card class="card demo-accounts" aria-labelledby="demo-accounts-title">
              <h2 id="demo-accounts-title">Demo accounts</h2>
              <p class="muted small">Password for both: <code>{{ demoPassword }}</code></p>
              <ul>
                @for (account of demoAccounts; track account.email) {
                  <li>
                    <div>
                      <strong>{{ account.role }}</strong>
                      <span class="muted small">{{ account.email }}</span>
                    </div>
                    <button type="button" class="btn btn-sm" (click)="useAccount(account.email)">Use</button>
                  </li>
                }
              </ul>
            </aside>
          }
        </app-auth-layout>
        `,
    styles: `
      form { display: grid; gap: 1rem; }
      .warning { font-size: 0.85rem; color: var(--text-secondary); }
      .demo-accounts { width: min(100%, 26rem); display: grid; gap: 0.6rem; }
      .demo-accounts ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
      .demo-accounts li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
      .demo-accounts li div { display: grid; }
      code { font-size: 0.9em; padding: 0.05rem 0.3rem; border-radius: 4px; background: var(--surface-2); }
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
                    this.error.set(error.error?.message ?? 'Sign in failed. Please try again.'),
            });
        }
    }
}
