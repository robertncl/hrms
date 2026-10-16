import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { TimeOffManagementComponent } from './time-off-management.component';
import { TimeOffManagementService } from 'src/app/services/time-off-management.service';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EmployeeService } from 'src/app/services/employee.service';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/infrastructure/types/user';
import { DemoRole } from 'src/app/demo/demo-data';
import { grantRole } from 'src/testing/roles';

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

  const currentUser = signal<User | null>(null);
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
        { provide: AuthService, useValue: { currentUser } },
      ],
    }).compileComponents();

    render('HR Administrator');
  });

  /** Renders the page for someone signed in with `role`. */
  function render(role: DemoRole, employeeId?: number) {
    grantRole(role);
    currentUser.set({ name: 'Test', email: '', role, ...(employeeId ? { employeeId } : {}) });
    fixture = TestBed.createComponent(TimeOffManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function rows(): HTMLElement[] {
    return Array.from(fixture.debugElement.nativeElement.querySelectorAll('.queue-row'));
  }

  function tabLabels(): string[] {
    return Array.from(
      fixture.debugElement.nativeElement.querySelectorAll('.tabs .tab') as NodeListOf<HTMLElement>,
    ).map((t) => t.textContent!.replace(/\s+/g, ' ').trim());
  }

  function buttonsIn(row: HTMLElement): string[] {
    return Array.from(row.querySelectorAll('button')).map((b) => b.textContent!.trim());
  }

  it('should count requests per status across the tabs', () => {
    expect(tabLabels()).toEqual(['Waiting · 1', 'Approved · 1', 'Declined · 0']);
  });

  it('should open on the waiting tab', () => {
    expect(component.status()).toBe('Pending');
    expect(rows().length).toBe(1);
    expect(rows()[0].textContent).toContain('Ada Lovelace');
  });

  it('should show employee names, falling back to the id when unknown', () => {
    expect(rows()[0].textContent).toContain('Ada Lovelace');

    component.status.set('Approved');
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain('Employee #11');
  });

  it('should offer Approve and Decline on waiting requests only', () => {
    expect(buttonsIn(rows()[0])).toEqual(['Decline', 'Approve']);

    component.status.set('Approved');
    fixture.detectChanges();
    expect(buttonsIn(rows()[0])).toEqual(['Delete']);
  });

  it('should call approveRequest when Approve is clicked', () => {
    const approve = Array.from(rows()[0].querySelectorAll('button'))
      .find((b) => b.textContent!.trim() === 'Approve')!;
    approve.click();

    expect(mockTimeOffsService.approveRequest).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('should call rejectRequest when Decline is clicked', () => {
    const decline = Array.from(rows()[0].querySelectorAll('button'))
      .find((b) => b.textContent!.trim() === 'Decline')!;
    decline.click();

    expect(mockTimeOffsService.rejectRequest).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('should call deleteRequest when Delete is clicked on a resolved request', () => {
    component.status.set('Approved');
    fixture.detectChanges();

    const remove = Array.from(rows()[0].querySelectorAll('button'))
      .find((b) => b.textContent!.trim() === 'Delete')!;
    remove.click();

    expect(mockTimeOffsService.deleteRequest).toHaveBeenCalledWith(mockRequests[1]);
  });

  it('should report the cover impact next to each waiting request', () => {
    // Ada is the only Developer, so nothing collides with her request.
    expect(rows()[0].textContent).toContain('No clashes');
  });

  it('should bulk-approve every waiting request with no clash', () => {
    const bulk = Array.from(
      fixture.debugElement.nativeElement.querySelectorAll('.tabs button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent!.includes('with no clashes'))!;
    expect(bulk.textContent).toContain('Approve 1 with no clashes');

    bulk.click();
    expect(mockTimeOffsService.approveRequest).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('should show an empty state on a tab with nothing in it', () => {
    component.status.set('Rejected');
    fixture.detectChanges();

    expect(rows().length).toBe(0);
    // Scoped to the queue card: the timeline above has an empty state too.
    const queue = fixture.debugElement.nativeElement.querySelector('[aria-labelledby="queue-title"]');
    expect(queue.querySelector('.empty-state').textContent).toContain('Nothing declined');
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

  describe('self-service', () => {
    const buttonLabels = (row: HTMLElement) =>
      Array.from(row.querySelectorAll('button')).map((b) => b.textContent!.trim());

    it("should show an employee only their own requests, with Withdraw instead of Approve", () => {
      render('Employee', 10);

      expect(tabLabels()).toEqual(['Waiting · 1', 'Approved · 0', 'Declined · 0']);
      expect(rows().length).toBe(1);
      expect(buttonLabels(rows()[0])).toEqual(['Withdraw']);
      expect(fixture.nativeElement.textContent).not.toContain('with no clashes');
      expect(fixture.nativeElement.textContent).toContain('Your request is waiting for approval.');
      expect(fixture.nativeElement.textContent).toContain('Waiting for approval');
    });

    it('should withdraw an employee\'s pending request', () => {
      render('Employee', 10);
      (rows()[0].querySelector('button') as HTMLButtonElement).click();
      expect(mockTimeOffsService.deleteRequest).toHaveBeenCalledWith(mockRequests[0]);
    });

    it('should book time off only for the employee themselves', () => {
      render('Employee', 10);
      component.openNewRequest();
      fixture.detectChanges();

      expect(component.newRequestForm.controls.employeeId.disabled).toBeTrue();
      expect(component.newRequestForm.controls.employeeId.value).toBe(10);
      component.newRequestForm.patchValue({ type: 'Vacation', startDate: '2026-04-01', endDate: '2026-04-02' });
      component.submitNewRequest();
      expect(mockTimeOffsService.createRequest).toHaveBeenCalledWith(jasmine.objectContaining({ employeeId: 10 }));
    });

    it('should let an approver book for anyone again after a self-service sign-in', () => {
      render('Employee', 10);
      component.openNewRequest();
      render('Team Lead', 1);
      component.openNewRequest();
      expect(component.newRequestForm.controls.employeeId.enabled).toBeTrue();
      expect(component.newRequestForm.controls.employeeId.value).toBeNull();
    });

    it('should give someone without a People record the calendar but no booking', () => {
      render('Recruiter');

      expect(fixture.nativeElement.querySelector('.page-actions')).toBeNull();
      expect(rows().length).toBe(0);
      expect(fixture.nativeElement.textContent).toContain('Who is out over the next six weeks.');
    });
  });
});
