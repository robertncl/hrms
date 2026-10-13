import { inject } from '@angular/core';
import { CanActivateFn, Router, } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';

export const authGuard: CanActivateFn = () => {
    const router = inject(Router);
    const authService = inject(AuthService);

    return authService.isAuth$.pipe(
        map((isAuth) => isAuth || router.createUrlTree(['/login'])),
    );
}

/** Keeps signed-in users away from the login and registration pages. */
export const guestGuard: CanActivateFn = () => {
    const router = inject(Router);
    const authService = inject(AuthService);

    return authService.isAuth$.pipe(
        map((isAuth) => !isAuth || router.createUrlTree(['/dashboard'])),
    );
}
