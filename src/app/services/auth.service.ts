import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Permissions } from '../infrastructure/types/permissions';
import { User } from '../infrastructure/types/user';
import { PermissionsService } from './permissions.service';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const PERMISSIONS_KEY = 'permissions';

type LoginResponse = {
    token: string;
    user?: User;
    permissions?: Partial<Record<Permissions, boolean>>;
};

@Injectable({providedIn: 'root'})
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly permissionsService = inject(PermissionsService);
    // Starts unauthenticated; restored from sessionStorage via APP_INITIALIZER.
    // NOTE: sessionStorage is still JS-readable — migrate to server-issued
    // HttpOnly cookies to fully eliminate XSS token theft.
    isAuth$ = new BehaviorSubject(false);
    readonly currentUser = signal<User | null>(null);

    login(credentials: { email: string, password: string }) {
        return this.http.post<LoginResponse>('/api/auth/login', credentials).pipe(
            tap(({ token, user, permissions }) => {
                sessionStorage.setItem(TOKEN_KEY, token);
                // Permissions only drive what the UI shows; the API must still
                // enforce them server-side.
                if (user) {
                    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
                    this.currentUser.set(user);
                }
                if (permissions) {
                    sessionStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
                    this.permissionsService.setPermissions(permissions);
                }
                this.isAuth$.next(true);
            }),
        );
    }

    register(credentials: { email: string, password: string }) {
        return this.http.post('/api/auth/register', credentials);
    }

    logout() {
        return this.http.post('/api/auth/logout', {}).pipe(
            tap(() => {
                sessionStorage.removeItem(TOKEN_KEY);
                sessionStorage.removeItem(USER_KEY);
                sessionStorage.removeItem(PERMISSIONS_KEY);
                this.currentUser.set(null);
                this.permissionsService.clearPermissions();
                this.isAuth$.next(false);
            }),
        );
    }

    getToken(): string | null {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    restoreSession(): void {
        if (this.getToken()) {
            this.currentUser.set(readJson<User>(USER_KEY));
            this.permissionsService.setPermissions(readJson(PERMISSIONS_KEY) ?? {});
            this.isAuth$.next(true);
        }
    }
}

function readJson<T>(key: string): T | null {
    try {
        return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null;
    } catch {
        return null;
    }
}
