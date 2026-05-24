import { HttpHandlerFn, HttpRequest, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<any>,
    next: HttpHandlerFn,
) => {
    const token = inject(AuthService).getToken();
    if (!token) {
        return next(req);
    }
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
}
