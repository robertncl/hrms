import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';

describe('TimeOffRequestService', () => {
  let service: TimeOffRequestService;
  let httpMock: HttpTestingController;

  const mockRequests: TimeOffRequest[] = [
    {
      id: 1,
      employeeId: 1,
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      type: 'Vacation',
      status: 'Pending',
    },
    {
      id: 2,
      employeeId: 2,
      startDate: '2026-02-01',
      endDate: '2026-02-02',
      type: 'Sick Leave',
      status: 'Approved',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TimeOffRequestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all requests', () => {
    service.getRequests().subscribe((requests) => {
      expect(requests).toEqual(mockRequests);
    });

    const req = httpMock.expectOne('/time-off-requests');
    expect(req.request.method).toBe('GET');
    req.flush(mockRequests);
  });

  it('should fetch all requests and filter by type on the client', () => {
    service.getRequestsByType('Vacation').subscribe((requests) => {
      expect(requests).toEqual([mockRequests[0]]);
    });

    const req = httpMock.expectOne('/time-off-requests');
    expect(req.request.method).toBe('GET');
    req.flush(mockRequests);
  });

  it('should return all requests when no type filter is provided', () => {
    service.getRequestsByType().subscribe((requests) => {
      expect(requests).toEqual(mockRequests);
    });

    const req = httpMock.expectOne('/time-off-requests');
    req.flush(mockRequests);
  });

  it('should reject a request', () => {
    service.rejectRequest(1).subscribe();

    const req = httpMock.expectOne('/time-off-requests/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'Rejected' });
    req.flush({});
  });

  it('should approve a request', () => {
    service.approveRequest(1).subscribe();

    const req = httpMock.expectOne('/time-off-requests/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'Approved' });
    req.flush({});
  });

  it('should delete a request', () => {
    service.deleteRequest(1).subscribe();

    const req = httpMock.expectOne('/time-off-requests/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
