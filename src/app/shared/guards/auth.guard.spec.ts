import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

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

  describe('guestGuard', () => {
    const runGuestGuard = () =>
      TestBed.runInInjectionContext(() => guestGuard(null as any, null as any));

    it('should allow signed-out users', (done) => {
      mockAuthService.isAuth$ = of(false);
      (runGuestGuard() as Observable<boolean>).subscribe((value) => {
        expect(value).toBeTrue();
        done();
      });
    });

    it('should send signed-in users to the dashboard', (done) => {
      mockAuthService.isAuth$ = of(true);
      (runGuestGuard() as Observable<UrlTree>).subscribe((value) => {
        expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
        expect(value).toBe(mockUrlTree);
        done();
      });
    });
  });
});
