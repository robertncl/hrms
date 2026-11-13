import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TimeOffManagementService } from './time-off-management.service';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';

describe('TimeOffManagementService', () => {
  let service: TimeOffManagementService;
  let mockTimeOffRequestService: jasmine.SpyObj<TimeOffRequestService>;

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
    localStorage.clear();
    mockTimeOffRequestService = jasmine.createSpyObj('TimeOffRequestService', [
      'getRequestsByType',
      'approveRequest',
      'rejectRequest',
      'deleteRequest',
      'createRequest',
    ]);
    mockTimeOffRequestService.getRequestsByType.and.returnValue(of(mockRequests));
    mockTimeOffRequestService.approveRequest.and.returnValue(of({}));
    mockTimeOffRequestService.rejectRequest.and.returnValue(of({}));
    mockTimeOffRequestService.deleteRequest.and.returnValue(of({}));
    mockTimeOffRequestService.createRequest.and.returnValue(of(mockRequests[0]));

    TestBed.configureTestingModule({
      providers: [{ provide: TimeOffRequestService, useValue: mockTimeOffRequestService }],
    });

    service = TestBed.inject(TimeOffManagementService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default selectedType to an empty string when localStorage is empty', () => {
    expect(service.selectedType()).toBe('');
  });

  it('should initialize selectedType from localStorage', () => {
    localStorage.setItem('selectedType', 'Vacation');

    const restoredService = TestBed.runInInjectionContext(() => new TimeOffManagementService());

    expect(restoredService.selectedType()).toBe('Vacation');
  });

  it('should fetch requests for the current type once the initial effect flushes', () => {
    TestBed.tick();

    expect(mockTimeOffRequestService.getRequestsByType).toHaveBeenCalledWith('');
    expect(service.requests()).toEqual(mockRequests);
  });

  it('should compute resolvedRequests excluding pending requests', () => {
    TestBed.tick();

    expect(service.resolvedRequests()).toEqual(mockRequests.filter((r) => r.status !== 'Pending'));
  });

  it('should approve a request and refresh the request list', () => {
    TestBed.tick();
    const request = mockRequests[0];

    service.approveRequest(request);

    expect(mockTimeOffRequestService.approveRequest).toHaveBeenCalledWith(request.id);
    expect(service.requests()).toEqual(mockRequests);
  });

  it('should reject a request and refresh the request list', () => {
    TestBed.tick();
    const request = mockRequests[0];

    service.rejectRequest(request);

    expect(mockTimeOffRequestService.rejectRequest).toHaveBeenCalledWith(request.id);
  });

  it('should delete a request and refresh the request list', () => {
    TestBed.tick();
    const request = mockRequests[0];

    service.deleteRequest(request);

    expect(mockTimeOffRequestService.deleteRequest).toHaveBeenCalledWith(request.id);
  });

  it('should persist selectedType to localStorage via the effect', () => {
    service.selectedType.set('Sick Leave');

    TestBed.tick();

    expect(localStorage.getItem('selectedType')).toBe('Sick Leave');
  });

  it('should create a request and refresh the request list', () => {
    TestBed.tick();
    mockTimeOffRequestService.getRequestsByType.calls.reset();
    const request = { employeeId: 3, startDate: '2026-03-01', endDate: '2026-03-02', type: 'Other' as const };

    service.createRequest(request);

    expect(mockTimeOffRequestService.createRequest).toHaveBeenCalledWith(request);
    expect(mockTimeOffRequestService.getRequestsByType).toHaveBeenCalled();
  });

  it('should list pending requests first, then by start date', () => {
    mockTimeOffRequestService.getRequestsByType.and.returnValue(of([
      { ...mockRequests[1], id: 5, startDate: '2026-01-10' },
      { ...mockRequests[0], id: 6, startDate: '2026-03-01' },
      { ...mockRequests[1], id: 7, startDate: '2026-01-01' },
      { ...mockRequests[0], id: 8, startDate: '2026-02-01' },
    ]));
    const sortedService = TestBed.runInInjectionContext(() => new TimeOffManagementService());
    TestBed.tick();

    expect(sortedService.requests().map((r) => r.id)).toEqual([8, 6, 7, 5]);
    expect(sortedService.pendingRequests().map((r) => r.id)).toEqual([8, 6]);
  });

  it('should re-read the list on refresh', () => {
    TestBed.tick();
    mockTimeOffRequestService.getRequestsByType.calls.reset();

    service.refresh();

    expect(mockTimeOffRequestService.getRequestsByType).toHaveBeenCalledTimes(1);
  });

  describe('when the API refuses a change', () => {
    const refusal = () => throwError(() => new HttpErrorResponse({
      status: 422, error: { message: 'This needs 2 days of vacation in 2026, and only 1 of 25 are left.' },
    }));

    it('should say why, and keep the list alive for the next action', () => {
      TestBed.tick();
      mockTimeOffRequestService.approveRequest.and.callFake(refusal);

      service.approveRequest(mockRequests[0]);
      expect(service.error()).toBe('This needs 2 days of vacation in 2026, and only 1 of 25 are left.');
      expect(service.requests()).toEqual(mockRequests);

      // The next action still goes out, and clears the message when it works.
      service.rejectRequest(mockRequests[0]);
      expect(mockTimeOffRequestService.rejectRequest).toHaveBeenCalledWith(1);
      expect(service.error()).toBe('');
    });

    it('should fall back to a general message when the API gives no reason', () => {
      TestBed.tick();
      mockTimeOffRequestService.deleteRequest.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      service.deleteRequest(mockRequests[0]);
      expect(service.error()).toBe("That change didn't go through. Try again.");
    });
  });

  it('should send every approval when several are made in a row', () => {
    TestBed.tick();
    // Each approval stays in flight until its subject completes.
    const inFlight: Subject<object>[] = [];
    mockTimeOffRequestService.approveRequest.and.callFake(() => {
      const response = new Subject<object>();
      inFlight.push(response);
      return response;
    });

    service.approveRequest(mockRequests[0]);
    service.approveRequest(mockRequests[1]);
    expect(inFlight.length).toBe(1);

    inFlight[0].next({});
    inFlight[0].complete();
    expect(mockTimeOffRequestService.approveRequest.calls.allArgs()).toEqual([[1], [2]]);
  });
});
