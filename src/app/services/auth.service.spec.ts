import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

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
});
