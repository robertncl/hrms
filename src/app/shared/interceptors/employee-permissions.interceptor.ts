import {
  HttpHandlerFn,
  HttpRequest,
  HttpInterceptorFn,
} from '@angular/common/http';
import { hasPermissions } from '../operators/has-permissions.operator';

export const employeePermissionsInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
) => {
    if (!req.url.includes('/employees')) {
        return next(req);
    }
    // Reading People needs only ViewEmployees. Requiring every employee
    // permission here would leave anyone with a narrower role staring at a
    // page that never finishes loading; changes are checked where they happen.
    return next(req).pipe(
        hasPermissions(['ViewEmployees']),
    );
};

