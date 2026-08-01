import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: { getToken: jasmine.Spy };

  beforeEach(() => {
    mockAuthService = { getToken: jasmine.createSpy('getToken').and.returnValue(null) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach an Authorization header when a token is present and the URL targets our API', () => {
    mockAuthService.getToken.and.returnValue('abc123');

    httpClient.get(`${environment.apiUrl}/employees`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush({});
  });

  it('should not attach an Authorization header when there is no token', () => {
    mockAuthService.getToken.and.returnValue(null);

    httpClient.get(`${environment.apiUrl}/employees`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should not attach an Authorization header for requests not bound for our API', () => {
    mockAuthService.getToken.and.returnValue('abc123');

    httpClient.get('https://external.example.com/data').subscribe();

    const req = httpMock.expectOne('https://external.example.com/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
