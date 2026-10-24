import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { addApiUrl, isApiRequest } from './api-url.interceptor';

describe('addApiUrl', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([addApiUrl])),
        provideHttpClientTesting(),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should prefix relative request URLs with the environment apiUrl', () => {
    httpClient.get('/employees').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees`);
    expect(req.request.url).toBe(`${environment.apiUrl}/employees`);
    req.flush({});
  });

  it('should preserve the original request method and body', () => {
    const body = { firstName: 'John' };
    httpClient.post('/employees', body).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('should leave absolute URLs alone', () => {
    httpClient.get('https://cdn.example.com/data.json').subscribe();
    httpMock.expectOne('https://cdn.example.com/data.json').flush({});
  });

  describe('isApiRequest', () => {
    it('should treat only same-origin URLs as the API when apiUrl is empty', () => {
      expect(isApiRequest('/employees', '')).toBeTrue();
      expect(isApiRequest(`${location.origin}/employees`, '')).toBeTrue();
      expect(isApiRequest('https://external.example.com/data', '')).toBeFalse();
      expect(isApiRequest('//external.example.com/data', '')).toBeFalse();
    });

    it('should match a configured apiUrl only on a path boundary', () => {
      expect(isApiRequest('https://api.acme.com/employees', 'https://api.acme.com')).toBeTrue();
      expect(isApiRequest('https://api.acme.com/employees', 'https://api.acme.com/')).toBeTrue();
      expect(isApiRequest('https://api.acme.com', 'https://api.acme.com')).toBeTrue();
      expect(isApiRequest('https://api.acme.com.evil.example/steal', 'https://api.acme.com')).toBeFalse();
      expect(isApiRequest('https://evil.example/https://api.acme.com/x', 'https://api.acme.com')).toBeFalse();
    });
  });
});
