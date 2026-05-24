import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export function addApiUrl(req: HttpRequest<any>, next: HttpHandlerFn) {
    return next(req.clone({ url: environment.apiUrl + req.url }));
}