import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

const TOKEN_KEY = 'token';

@Injectable({providedIn: 'root'})
export class AuthService {
    private readonly http = inject(HttpClient);
    // Starts unauthenticated; restored from sessionStorage via APP_INITIALIZER.
    // NOTE: sessionStorage is still JS-readable — migrate to server-issued
    // HttpOnly cookies to fully eliminate XSS token theft.
    isAuth$ = new BehaviorSubject(false);

    login(credentials: { email: string, password: string }) {
        return this.http.post<{ token: string }>('/api/auth/login', credentials).pipe(
            tap(({ token }) => {
                sessionStorage.setItem(TOKEN_KEY, token);
                this.isAuth$.next(true);
            }),
        );
    }

    logout() {
        return this.http.post('/api/auth/logout', {}).pipe(
            tap(() => {
                sessionStorage.removeItem(TOKEN_KEY);
                this.isAuth$.next(false);
            }),
        );
    }

    getToken(): string | null {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    restoreSession(): void {
        if (this.getToken()) {
            this.isAuth$.next(true);
        }
    }
}