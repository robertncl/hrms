import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { Permissions } from 'src/app/infrastructure/types/permissions';
import { PermissionsService } from 'src/app/services/permissions.service';

/** Lets the route through only with `permission`; otherwise redirects to `fallback`. */
export function permissionGuard(permission: Permissions, fallback: string): CanActivateFn {
    return () => {
        const router = inject(Router);
        return inject(PermissionsService).hasPermission(permission).pipe(
            map((allowed) => allowed || router.createUrlTree([fallback])),
        );
    };
}
