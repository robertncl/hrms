import { HttpHandlerFn, HttpRequest, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { isApiRequest } from './api-url.interceptor';

export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<any>,
    next: HttpHandlerFn,
) => {
    const token = inject(AuthService).getToken();
    // Only attach the token to requests bound for our own API.
    if (!token || !isApiRequest(req.url)) {
        return next(req);
    }
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
}
