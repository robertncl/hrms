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
import { LeaveBalanceService } from 'src/app/services/leave-balance.service';
import { LeaveBalance } from 'src/app/shared/functions/leave';
import { Employee } from 'src/app/infrastructure/types/employee';

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
    refresh: jasmine.Spy;
    error: ReturnType<typeof signal<string>>;
  };

  const person = (id: number, firstName: string, position: Employee['position'], managerId?: number): Employee => ({
    id, firstName, lastName: 'Lovelace', email: '', position, level: 'Lead', isAvailable: true, profilePicture: '',
    location: 'London', ...(managerId ? { managerId } : {}),
  });
  /** Olivia (1) leads Ada (10); Sam (12) is on another team. Request 2 is from someone no longer listed. */
  const people = [person(1, 'Olivia', 'Manager'), person(10, 'Ada', 'Developer', 1), person(12, 'Sam', 'QA')];
  const balances: LeaveBalance[] = [
    { employeeId: 10, year: 2026, type: 'Vacation', entitlement: 25, taken: 4, pending: 2, remaining: 19 },
    { employeeId: 10, year: 2026, type: 'Sick Leave', entitlement: 10, taken: 0, pending: 0, remaining: 10 },
    { employeeId: 10, year: 2026, type: 'Other', entitlement: 3, taken: 1, pending: 0, remaining: 2 },
  ];
  let getBalances: jasmine.Spy;

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
      refresh: jasmine.createSpy('refresh'),
      error: signal(''),
    };
    getBalances = jasmine.createSpy('getBalances').and.returnValue(of(balances));

    await TestBed.configureTestingModule({
      imports: [TimeOffManagementComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: EmployeeService,
          useValue: { getEmployees: () => of(people) },
        },
        { provide: LeaveBalanceService, useValue: { getBalances } },
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

  it('should start from the full, current list of requests', () => {
    selectedTypeSignal.set('Vacation');
    render('HR Administrator');

    expect(selectedTypeSignal()).toBe('');
    expect(mockTimeOffsService.refresh).toHaveBeenCalled();
  });

  it('should count leave in working days, skipping weekends and public holidays', () => {
    // 1–5 Jan 2026: New Year's Day, a Friday, a weekend and a Monday.
    expect(rows()[0].textContent).toContain('2 days');
  });

  it('should show why the API refused an action', () => {
    mockTimeOffsService.error.set('Ada has only 1 day of vacation left.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert-error').textContent).toContain('only 1 day of vacation left');
  });

  describe('leave balances', () => {
    const strip = () =>
      Array.from(fixture.nativeElement.querySelectorAll('.balance-strip > div') as NodeListOf<HTMLElement>)
        .map((item) => `${item.querySelector('dt')!.textContent!.trim()}: ${item.querySelector('dd')!.textContent!.replace(/\s+/g, ' ').trim()}`);

    it("should show the signed-in person's remaining days per leave type", async () => {
      render('Employee', 10);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getBalances).toHaveBeenCalledWith(10);
      expect(strip()).toEqual([
        'Vacation: 19 of 25 days left 2 waiting for approval',
        'Sick leave: 10 of 10 days left',
        'Personal: 2 of 3 days left',
      ]);
    });

    it('should re-read the balances when the requests change', async () => {
      render('Employee', 10);
      await fixture.whenStable();
      getBalances.calls.reset();

      requestsSignal.set([...mockRequests]);
      TestBed.tick();
      await fixture.whenStable();
      expect(getBalances).toHaveBeenCalledWith(10);
    });

    it('should leave the balances out for someone without a People record', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getBalances).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.balance-card')).toBeNull();
    });

    it('should say what a request would cost before it is sent', () => {
      component.openNewRequest();
      // Friday to Monday: the weekend in between is free.
      component.newRequestForm.patchValue({ employeeId: 10, type: 'Vacation', startDate: '2026-03-06', endDate: '2026-03-09' });
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('.leave-preview') as HTMLElement;
      expect(preview.textContent!.replace(/\s+/g, ' ').trim()).toBe('Uses 2 working days. 21 of 25 left afterwards.');
      expect(preview.classList).not.toContain('is-problem');
    });

    it('should say when a type of leave has no yearly limit', () => {
      component.openNewRequest();
      component.newRequestForm.patchValue({ employeeId: 10, type: 'Maternity Leave', startDate: '2026-03-02', endDate: '2026-03-06' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.leave-preview').textContent).toContain('no yearly limit');
    });

    it('should refuse a request for more days than are left', () => {
      component.openNewRequest();
      // Four working days of personal leave against an allowance of three.
      component.newRequestForm.patchValue({ employeeId: 10, type: 'Other', startDate: '2026-03-02', endDate: '2026-03-05' });
      fixture.detectChanges();

      const preview = fixture.nativeElement.querySelector('.leave-preview') as HTMLElement;
      expect(preview.textContent).toContain('This needs 4 days of personal leave in 2026, and only 3 of 3 are left.');
      expect(preview.classList).toContain('is-problem');
      expect((fixture.nativeElement.querySelector('dialog button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();

      component.submitNewRequest();
      expect(mockTimeOffsService.createRequest).not.toHaveBeenCalled();
    });

    it('should refuse a request that falls only on a weekend', () => {
      component.openNewRequest();
      component.newRequestForm.patchValue({ employeeId: 10, type: 'Vacation', startDate: '2026-03-07', endDate: '2026-03-08' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.leave-preview').textContent).toContain('all weekends or public holidays');
    });
  });

  describe('for a lead, who decides only for their own reports', () => {
    const others: TimeOffRequest[] = [
      { id: 3, employeeId: 12, startDate: '2026-01-12', endDate: '2026-01-13', type: 'Vacation', status: 'Pending' },
      { id: 4, employeeId: 1, startDate: '2026-01-19', endDate: '2026-01-20', type: 'Vacation', status: 'Pending' },
    ];
    const bookable = () =>
      Array.from(fixture.nativeElement.querySelectorAll('#request-employee option') as NodeListOf<HTMLOptionElement>)
        .map((option) => option.textContent!.trim());

    beforeEach(() => {
      requestsSignal.set([...mockRequests, ...others]);
      render('Team Lead', 1);
    });

    it("should list their reports' requests and their own, but nobody else's", () => {
      expect(tabLabels()).toEqual(['Waiting · 2', 'Approved · 0', 'Declined · 0']);
      expect(rows().map((row) => row.querySelector('a')!.textContent!.trim()))
        .toEqual(['Ada Lovelace', 'Olivia Lovelace']);
    });

    it("should decide a report's request but only withdraw their own", () => {
      expect(buttonsIn(rows()[0])).toEqual(['Decline', 'Approve']);
      expect(buttonsIn(rows()[1])).toEqual(['Withdraw']);
      expect(fixture.nativeElement.textContent).toContain('1 request is waiting.');
    });

    it('should bulk-approve only the requests they decide', () => {
      const bulk = Array.from(
        fixture.nativeElement.querySelectorAll('.tabs button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent!.includes('with no clashes'))!;
      expect(bulk.textContent).toContain('Approve 1 with no clashes');

      bulk.click();
      expect(mockTimeOffsService.approveRequest.calls.allArgs()).toEqual([[mockRequests[0]]]);
    });

    it('should book only for themselves and their reports', () => {
      component.openNewRequest();
      fixture.detectChanges();

      expect(bookable()).toEqual(['Choose a person', 'Olivia Lovelace', 'Ada Lovelace']);
      expect(fixture.nativeElement.textContent).toContain('for yourself and for the people who report to you');
    });

    it('should let HR book for anyone', () => {
      render('HR Administrator');
      component.openNewRequest();
      fixture.detectChanges();

      expect(bookable()).toEqual(['Choose a person', 'Olivia Lovelace', 'Ada Lovelace', 'Sam Lovelace']);
    });
  });
});
