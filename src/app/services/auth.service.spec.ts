import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { firstValueFrom } from 'rxjs';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start unauthenticated', () => {
    expect(service.isAuth$.getValue()).toBe(false);
  });

  it('should send a login request and store the token on success', () => {
    const credentials = { email: 'jane@example.com', password: 'secret' };

    service.login(credentials).subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    req.flush({ token: 'abc123' });

    expect(sessionStorage.getItem('token')).toBe('abc123');
    expect(service.isAuth$.getValue()).toBe(true);
  });

  it('should send a logout request and clear the token', () => {
    sessionStorage.setItem('token', 'abc123');
    service.isAuth$.next(true);

    service.logout().subscribe();

    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(service.isAuth$.getValue()).toBe(false);
  });

  it('should read the token from sessionStorage via getToken', () => {
    expect(service.getToken()).toBeNull();

    sessionStorage.setItem('token', 'xyz789');
    expect(service.getToken()).toBe('xyz789');
  });

  it('should set isAuth$ to true on restoreSession if a token exists', () => {
    sessionStorage.setItem('token', 'xyz789');

    service.restoreSession();

    expect(service.isAuth$.getValue()).toBe(true);
  });

  it('should not change isAuth$ on restoreSession if no token exists', () => {
    service.restoreSession();

    expect(service.isAuth$.getValue()).toBe(false);
  });

  it('should keep the user and permissions from the login response', async () => {
    const permissions = TestBed.inject(PermissionsService);
    service.login({ email: 'jane@example.com', password: 'secret' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush({
      token: 'abc123',
      user: { name: 'Jane Doe', email: 'jane@example.com', role: 'HR Administrator' },
      permissions: { DeleteEmployee: true },
    });

    expect(service.currentUser()?.name).toBe('Jane Doe');
    expect(await firstValueFrom(permissions.hasPermission('DeleteEmployee'))).toBeTrue();
  });

  it('should restore the user and permissions with the session', async () => {
    const permissions = TestBed.inject(PermissionsService);
    sessionStorage.setItem('token', 'xyz789');
    sessionStorage.setItem('user', JSON.stringify({ name: 'Jane Doe', email: 'j@e.com', role: 'Team Lead' }));
    sessionStorage.setItem('permissions', JSON.stringify({ ViewEmployees: true }));

    service.restoreSession();

    expect(service.currentUser()?.role).toBe('Team Lead');
    expect(await firstValueFrom(permissions.hasPermission('ViewEmployees'))).toBeTrue();
  });

  it('should clear the user and permissions on logout', async () => {
    const permissions = TestBed.inject(PermissionsService);
    sessionStorage.setItem('token', 'abc123');
    permissions.setPermissions({ ViewEmployees: true });
    service.currentUser.set({ name: 'Jane Doe', email: 'j@e.com', role: 'Team Lead' });

    service.logout().subscribe();
    httpMock.expectOne('/api/auth/logout').flush({});

    expect(service.currentUser()).toBeNull();
    expect(sessionStorage.getItem('permissions')).toBeNull();
    expect(await firstValueFrom(permissions.hasPermission('ViewEmployees'))).toBeFalse();
  });

  it('should send a registration request', () => {
    service.register({ email: 'jane@example.com', password: 'secret' }).subscribe();

    const req = httpMock.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'jane@example.com', password: 'secret' });
    req.flush({});
  });

  describe('restoreSession', () => {
    const restore = () => {
      let done = false;
      service.restoreSession().subscribe({ complete: () => (done = true) });
      return () => done;
    };

    it('should complete straight away without a saved token', () => {
      const done = restore();
      httpMock.expectNone('/api/auth/session');
      expect(done()).toBeTrue();
    });

    it('should check the saved session with the API and take its current permissions', async () => {
      const permissions = TestBed.inject(PermissionsService);
      sessionStorage.setItem('token', 'xyz789');
      sessionStorage.setItem('user', JSON.stringify({ name: 'Old Name', email: 'j@e.com', role: 'Team Lead' }));
      sessionStorage.setItem('permissions', JSON.stringify({ ManageCourses: true, ViewEmployees: true }));

      const done = restore();
      // The saved copy applies at once, before the API answers.
      expect(service.isAuth$.getValue()).toBeTrue();
      expect(done()).toBeFalse();

      const req = httpMock.expectOne('/api/auth/session');
      expect(req.request.method).toBe('GET');
      req.flush({
        user: { name: 'Olivia Bennett', email: 'lead@acme.com', role: 'Team Lead', employeeId: 1 },
        permissions: { ViewEmployees: true, ApproveTimeOff: true },
      });

      expect(done()).toBeTrue();
      expect(service.currentUser()).toEqual({ name: 'Olivia Bennett', email: 'lead@acme.com', role: 'Team Lead', employeeId: 1 });
      expect(await firstValueFrom(permissions.hasPermission('ApproveTimeOff'))).toBeTrue();
      // Replaced, not merged: a permission the role no longer has is gone.
      expect(await firstValueFrom(permissions.hasPermission('ManageCourses'))).toBeFalse();
      expect(JSON.parse(sessionStorage.getItem('permissions')!)).toEqual({ ViewEmployees: true, ApproveTimeOff: true });
    });

    it('should sign out a session the API no longer recognises', () => {
      sessionStorage.setItem('token', 'demo-old');
      sessionStorage.setItem('user', JSON.stringify({ name: 'Sam Rivera', email: 'lead@hrms.demo', role: 'Team Lead' }));

      const done = restore();
      httpMock.expectOne('/api/auth/session').flush({ message: 'Your session has ended.' }, { status: 401, statusText: 'Unauthorized' });

      expect(done()).toBeTrue();
      expect(service.isAuth$.getValue()).toBeFalse();
      expect(service.currentUser()).toBeNull();
      expect(sessionStorage.getItem('token')).toBeNull();
    });

    it('should keep the saved session through a network failure', () => {
      sessionStorage.setItem('token', 'xyz789');
      sessionStorage.setItem('user', JSON.stringify({ name: 'Jane Doe', email: 'j@e.com', role: 'Employee' }));

      const done = restore();
      httpMock.expectOne('/api/auth/session').error(new ProgressEvent('error'));

      expect(done()).toBeTrue();
      expect(service.isAuth$.getValue()).toBeTrue();
      expect(service.currentUser()?.name).toBe('Jane Doe');
    });
  });

  it('should not carry permissions from one sign-in into the next', async () => {
    const permissions = TestBed.inject(PermissionsService);
    service.login({ email: 'admin@acme.com', password: 'demo' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush({ token: 'a', permissions: { DeleteEmployee: true } });
    service.login({ email: 'employee@acme.com', password: 'demo' }).subscribe();
    httpMock.expectOne('/api/auth/login').flush({ token: 'b', permissions: { ViewEmployees: true } });

    expect(await firstValueFrom(permissions.hasPermission('DeleteEmployee'))).toBeFalse();
  });
});
