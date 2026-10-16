import { Injectable, Signal, computed, signal } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { Permissions } from '../infrastructure/types/permissions';

type PermissionSet = Partial<Record<Permissions, boolean>>;

@Injectable({providedIn: 'root'})
export class PermissionsService {
    // Permissions are populated after login via setPermissions().
    // Starting empty ensures no access is granted before the server responds.
    private readonly permissions$ = new BehaviorSubject<PermissionSet>({});
    /** The same state as a signal, for templates. */
    private readonly state = signal<PermissionSet>({});

    hasPermission(permission: Permissions) {
        return this.permissions$.pipe(map(permissions => permissions[permission] ?? false));
    }

    hasPermissions(permissions: Permissions[]) {
        return this.permissions$.pipe(map(existingPermissions => permissions.every(permission => existingPermissions[permission] ?? false)));
    }

    /** Signal form of hasPermission(). */
    can(permission: Permissions): Signal<boolean> {
        return computed(() => this.state()[permission] ?? false);
    }

    setPermissions(permissions: PermissionSet) {
        this.next({...this.permissions$.getValue(), ...permissions});
    }

    /** Swaps in a complete set, dropping anything granted before. */
    replacePermissions(permissions: PermissionSet) {
        this.next({...permissions});
    }

    clearPermissions() {
        this.next({});
    }

    revokePermission(permission: Permissions) {
        this.next({...this.permissions$.getValue(), [permission]: false});
    }

    private next(permissions: PermissionSet) {
        this.permissions$.next(permissions);
        this.state.set(permissions);
    }
}
