import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Permissions } from '../infrastructure/types/permissions';
import { User } from '../infrastructure/types/user';
import { PermissionsService } from './permissions.service';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const PERMISSIONS_KEY = 'permissions';

type PermissionSet = Partial<Record<Permissions, boolean>>;

type SessionResponse = {
    user?: User;
    permissions?: PermissionSet;
};

type LoginResponse = SessionResponse & {
    token: string;
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
            tap(({ token, ...session }) => {
                sessionStorage.setItem(TOKEN_KEY, token);
                this.applySession(session);
                this.isAuth$.next(true);
            }),
        );
    }

    register(credentials: { email: string, password: string }) {
        return this.http.post('/api/auth/register', credentials);
    }

    logout() {
        return this.http.post('/api/auth/logout', {}).pipe(
            tap(() => this.clearSession()),
        );
    }

    getToken(): string | null {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    /**
     * Picks up a session saved in this tab, then asks the API whether it still
     * holds. The saved copy makes the app usable at once; the check replaces
     * permissions that have changed since (a role edited, a new permission
     * shipped) and signs out a session the API no longer recognises.
     *
     * Completes once the check is done, so APP_INITIALIZER can wait for it.
     */
    restoreSession(): Observable<void> {
        if (!this.getToken()) {
            return of(undefined);
        }
        this.currentUser.set(readJson<User>(USER_KEY));
        this.permissionsService.replacePermissions(readJson<PermissionSet>(PERMISSIONS_KEY) ?? {});
        this.isAuth$.next(true);

        return this.http.get<SessionResponse>('/api/auth/session').pipe(
            tap((session) => this.applySession(session)),
            map(() => undefined),
            catchError((error: HttpErrorResponse) => {
                // Only a definite "no" signs out; a network blip keeps the saved session.
                if (error.status === 401) {
                    this.clearSession();
                }
                return of(undefined);
            }),
        );
    }

    private applySession({ user, permissions }: SessionResponse) {
        // Permissions only drive what the UI shows; the API must still
        // enforce them server-side.
        if (user) {
            sessionStorage.setItem(USER_KEY, JSON.stringify(user));
            this.currentUser.set(user);
        }
        if (permissions) {
            sessionStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
            this.permissionsService.replacePermissions(permissions);
        }
    }

    private clearSession() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(PERMISSIONS_KEY);
        this.currentUser.set(null);
        this.permissionsService.clearPermissions();
        this.isAuth$.next(false);
    }
}

function readJson<T>(key: string): T | null {
    try {
        return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null;
    } catch {
        return null;
    }
}
