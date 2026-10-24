import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { environment } from 'src/environments/environment';

/** A path on our own API, like `/employees` (but not a protocol-relative `//host`). */
const isRelativePath = (url: string) => url.startsWith('/') && !url.startsWith('//');

/**
 * Whether `url` (after addApiUrl has run) is bound for our API, so it may
 * carry the session token.
 *
 * With no apiUrl the API is same-origin, so only this origin counts; checking
 * `startsWith('')` would match every host on the internet. With an apiUrl the
 * match stops at a path boundary, so `https://api.acme.com.evil.example` does
 * not pass for `https://api.acme.com`.
 */
export function isApiRequest(url: string, apiUrl = environment.apiUrl): boolean {
    if (!apiUrl) {
        if (isRelativePath(url)) return true;
        try {
            return new URL(url).origin === globalThis.location?.origin;
        } catch {
            return false;
        }
    }
    const base = apiUrl.replace(/\/+$/, '');
    return url === base || url.startsWith(`${base}/`);
}

/** Points relative API paths at apiUrl; absolute URLs are left alone. */
export function addApiUrl(req: HttpRequest<any>, next: HttpHandlerFn) {
    if (!isRelativePath(req.url)) {
        return next(req);
    }
    return next(req.clone({ url: environment.apiUrl.replace(/\/+$/, '') + req.url }));
}
