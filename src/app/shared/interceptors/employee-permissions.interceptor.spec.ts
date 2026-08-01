import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PermissionsService } from 'src/app/services/permissions.service';
import { employeePermissionsInterceptor } from './employee-permissions.interceptor';

describe('employeePermissionsInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let mockPermissionsService: { hasPermissions: jasmine.Spy };

  beforeEach(() => {
    mockPermissionsService = { hasPermissions: jasmine.createSpy('hasPermissions').and.returnValue(of(true)) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([employeePermissionsInterceptor])),
        provideHttpClientTesting(),
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should let responses through for /employees requests when permissions are granted', () => {
    let response: unknown;
    httpClient.get('/employees').subscribe((res) => (response = res));

    const req = httpMock.expectOne('/employees');
    req.flush([{ id: 1 }]);

    expect(response).toEqual([{ id: 1 }]);
    expect(mockPermissionsService.hasPermissions).toHaveBeenCalledWith([
      'CreateEmployee',
      'DeleteEmployee',
      'EditEmployeeGeneralDetails',
      'ViewEmployees',
    ]);
  });

  it('should filter out the response for /employees requests when permissions are not granted', () => {
    mockPermissionsService.hasPermissions.and.returnValue(of(false));

    let emitted = false;
    httpClient.get('/employees').subscribe(() => (emitted = true));

    const req = httpMock.expectOne('/employees');
    req.flush([{ id: 1 }]);

    expect(emitted).toBeFalse();
  });

  it('should bypass permission checks entirely for non /employees requests', () => {
    let response: unknown;
    httpClient.get('/candidates').subscribe((res) => (response = res));

    const req = httpMock.expectOne('/candidates');
    req.flush([{ id: 2 }]);

    expect(response).toEqual([{ id: 2 }]);
    expect(mockPermissionsService.hasPermissions).not.toHaveBeenCalled();
  });
});
