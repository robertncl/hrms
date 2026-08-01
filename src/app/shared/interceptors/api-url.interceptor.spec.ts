import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from 'src/environments/environment';
import { addApiUrl } from './api-url.interceptor';

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
});
