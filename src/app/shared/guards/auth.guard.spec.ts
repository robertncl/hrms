import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let mockAuthService: { isAuth$: Observable<boolean> };
  let mockRouter: { createUrlTree: jasmine.Spy };
  let mockUrlTree: UrlTree;

  const runGuard = () =>
    TestBed.runInInjectionContext(() => authGuard(null as any, null as any));

  beforeEach(() => {
    mockUrlTree = {} as UrlTree;
    mockRouter = {
      createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue(mockUrlTree),
    };

    mockAuthService = { isAuth$: of(true) };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
  });

  it('should allow activation when the user is authenticated', (done) => {
    mockAuthService.isAuth$ = of(true);

    const result = runGuard();
    (result as Observable<boolean>).subscribe((value) => {
      expect(value).toBeTrue();
      expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
      done();
    });
  });

  it('should redirect to /login when the user is not authenticated', (done) => {
    mockAuthService.isAuth$ = of(false);

    const result = runGuard();
    (result as Observable<boolean | UrlTree>).subscribe((value) => {
      expect(value).toBe(mockUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
      done();
    });
  });
});
