import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
    ]);
    mockTimeOffRequestService.getRequestsByType.and.returnValue(of(mockRequests));
    mockTimeOffRequestService.approveRequest.and.returnValue(of({}));
    mockTimeOffRequestService.rejectRequest.and.returnValue(of({}));
    mockTimeOffRequestService.deleteRequest.and.returnValue(of({}));

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
});
