import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { TimeOffManagementComponent } from './time-off-management.component';
import { TimeOffManagementService } from 'src/app/services/time-off-management.service';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';

describe('TimeOffManagementComponent', () => {
  let component: TimeOffManagementComponent;
  let fixture: ComponentFixture<TimeOffManagementComponent>;

  const mockRequests: TimeOffRequest[] = [
    {
      id: 1,
      employeeId: 10,
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      type: 'Vacation',
      status: 'Pending',
      comment: 'Trip',
    },
    {
      id: 2,
      employeeId: 11,
      startDate: '2026-02-01',
      endDate: '2026-02-02',
      type: 'Sick Leave',
      status: 'Approved',
      comment: '',
    },
  ];

  let requestsSignal: ReturnType<typeof signal<TimeOffRequest[]>>;
  let selectedTypeSignal: ReturnType<typeof signal<string>>;
  let mockTimeOffsService: {
    requests: ReturnType<typeof signal<TimeOffRequest[]>>;
    resolvedRequests: () => TimeOffRequest[];
    selectedType: ReturnType<typeof signal<string>>;
    approveRequest: jasmine.Spy;
    rejectRequest: jasmine.Spy;
    deleteRequest: jasmine.Spy;
  };

  beforeEach(async () => {
    requestsSignal = signal<TimeOffRequest[]>(mockRequests);
    selectedTypeSignal = signal<string>('');
    mockTimeOffsService = {
      requests: requestsSignal,
      resolvedRequests: () => requestsSignal().filter((r) => r.status !== 'Pending'),
      selectedType: selectedTypeSignal,
      approveRequest: jasmine.createSpy('approveRequest'),
      rejectRequest: jasmine.createSpy('rejectRequest'),
      deleteRequest: jasmine.createSpy('deleteRequest'),
    };

    await TestBed.configureTestingModule({
      imports: [TimeOffManagementComponent, NoopAnimationsModule],
      providers: [
        { provide: TimeOffManagementService, useValue: mockTimeOffsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeOffManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display resolved and total counts', () => {
    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain('Resolved 1 / 2 Unresolved');
  });

  it('should render a table row for each request', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('should show Approve and Reject buttons only for pending requests', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('tbody tr');
    const pendingRow = rows[0] as HTMLElement;
    const approvedRow = rows[1] as HTMLElement;

    const pendingButtons = Array.from(pendingRow.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(pendingButtons).toContain('Approve');
    expect(pendingButtons).toContain('Reject');
    expect(pendingButtons).toContain('Delete');

    const approvedButtons = Array.from(approvedRow.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(approvedButtons).not.toContain('Approve');
    expect(approvedButtons).not.toContain('Reject');
    expect(approvedButtons).toContain('Delete');
  });

  it('should call approveRequest on the service when Approve is clicked', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('tbody tr');
    const approveButton = Array.from(rows[0].querySelectorAll('button')).find(
      (b: any) => b.textContent.trim() === 'Approve'
    ) as HTMLButtonElement;

    approveButton.click();

    expect(mockTimeOffsService.approveRequest).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('should call rejectRequest on the service when Reject is clicked', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('tbody tr');
    const rejectButton = Array.from(rows[0].querySelectorAll('button')).find(
      (b: any) => b.textContent.trim() === 'Reject'
    ) as HTMLButtonElement;

    rejectButton.click();

    expect(mockTimeOffsService.rejectRequest).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('should call deleteRequest on the service when Delete is clicked', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('tbody tr');
    const deleteButton = Array.from(rows[1].querySelectorAll('button')).find(
      (b: any) => b.textContent.trim() === 'Delete'
    ) as HTMLButtonElement;

    deleteButton.click();

    expect(mockTimeOffsService.deleteRequest).toHaveBeenCalledWith(mockRequests[1]);
  });

  it('should update the selectedType signal when the filter select changes', () => {
    const select: HTMLSelectElement = fixture.debugElement.nativeElement.querySelector('select');
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(selectedTypeSignal()).toBe('Vacation');
  });
});
