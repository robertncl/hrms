import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { TimeOffManagementComponent } from './time-off-management.component';
import { TimeOffManagementService } from 'src/app/services/time-off-management.service';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EmployeeService } from 'src/app/services/employee.service';

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
    createRequest: jasmine.Spy;
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
      createRequest: jasmine.createSpy('createRequest'),
    };

    await TestBed.configureTestingModule({
      imports: [TimeOffManagementComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: EmployeeService,
          useValue: {
            getEmployees: () => of([
              { id: 10, firstName: 'Ada', lastName: 'Lovelace', email: '', position: 'Developer', level: 'Lead', isAvailable: true, profilePicture: '' },
            ]),
          },
        },
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

  it('should display the count of requests per status', () => {
    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain('1 pending');
    expect(text).toContain('1 approved');
    expect(text).toContain('0 rejected');
  });

  it('should show employee names, falling back to the id when unknown', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Ada Lovelace');
    expect(rows[1].textContent).toContain('Employee #11');
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

  it('should submit a new request from the dialog', () => {
    component.openNewRequest();
    component.newRequestForm.patchValue({ employeeId: 10, type: 'Other', startDate: '2026-03-02', endDate: '2026-03-03', comment: ' Dentist ' });
    component.submitNewRequest();

    expect(mockTimeOffsService.createRequest).toHaveBeenCalledWith({
      employeeId: 10, type: 'Other', startDate: '2026-03-02', endDate: '2026-03-03', comment: 'Dentist',
    });
  });

  it('should not submit a request that ends before it starts', () => {
    component.openNewRequest();
    component.newRequestForm.patchValue({ employeeId: 10, startDate: '2026-03-05', endDate: '2026-03-01' });
    component.submitNewRequest();

    expect(component.newRequestForm.hasError('endBeforeStart')).toBeTrue();
    expect(mockTimeOffsService.createRequest).not.toHaveBeenCalled();
  });

  it('should submit the new request form when its button is clicked', () => {
    spyOn(component, 'submitNewRequest');
    (fixture.nativeElement.querySelector('dialog button[type="submit"]') as HTMLButtonElement).click();
    expect(component.submitNewRequest).toHaveBeenCalled();
  });
});
