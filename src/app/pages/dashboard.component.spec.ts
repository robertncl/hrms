import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DashboardComponent } from './dashboard.component';
import { EmployeeService } from '../services/employee.service';
import { TimeOffRequestService } from '../services/time-off-request.service';
import { CandidateService } from '../services/candidate.service';
import { CourseService } from '../services/course.service';
import { EnrollmentService } from '../services/enrollment.service';
import { AuthService } from '../services/auth.service';
import { Employee } from '../infrastructure/types/employee';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { Candidate } from '../infrastructure/types/candidate';
import { Course, Enrollment } from '../infrastructure/types/course';
import { DemoRole, daysFromToday } from '../demo/demo-data';
import { User } from '../infrastructure/types/user';
import { grantRole } from 'src/testing/roles';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let mockTimeOffRequestService: { getRequests: jasmine.Spy; approveRequest: jasmine.Spy; rejectRequest: jasmine.Spy };
  let mockCandidateService: { getCandidates: jasmine.Spy };
  const currentUser = signal<User | null>(null);

  const employee = (id: number, position: Employee['position'], isAvailable = true): Employee => ({
    id, firstName: `First${id}`, lastName: `Last${id}`, email: '', position, level: 'Senior', isAvailable, profilePicture: '',
  });
  // First1 reports to a lead (9) who isn't in this list; the others report to nobody.
  const employees = [{ ...employee(1, 'Developer'), managerId: 9 }, employee(2, 'Developer', false), employee(3, 'QA')];
  // Built per test, after the clock is pinned (see beforeEach).
  let requests: TimeOffRequest[] = [];
  const buildRequests = (): TimeOffRequest[] => [
    { id: 1, employeeId: 1, startDate: daysFromToday(3), endDate: daysFromToday(4), type: 'Vacation', status: 'Pending' },
    { id: 2, employeeId: 2, startDate: daysFromToday(-1), endDate: daysFromToday(2), type: 'Sick Leave', status: 'Approved' },
    { id: 3, employeeId: 3, startDate: daysFromToday(30), endDate: daysFromToday(31), type: 'Vacation', status: 'Approved' },
  ];
  const candidate = (id: number, status: string, extra: Partial<Candidate> = {}): Candidate => ({
    id, firstName: 'C', lastName: `${id}`, email: '', position: 'QA', level: 'Junior', status, offerAccepted: false, ...extra,
  });
  const candidates = [
    candidate(1, 'CV evaluation'),
    candidate(2, 'CV evaluation'),
    candidate(3, 'Approved', { offerAccepted: true }),
    candidate(4, 'Rejected'),
    candidate(5, 'Approved', { offerAccepted: true, employeeId: 9 }),
  ];

  const enrollment = (id: number, status: Enrollment['status'], dueDate?: string): Enrollment => ({
    id, courseId: 1, employeeId: 1, assignedAt: '', completedModules: 0, status, progress: 0, ...(dueDate ? { dueDate } : {}),
  });
  let enrollments: Enrollment[] = [];
  const buildEnrollments = () => [
    enrollment(1, 'Completed', daysFromToday(-5)),
    enrollment(2, 'In progress', daysFromToday(-1)),
    enrollment(3, 'Not started', daysFromToday(5)),
    enrollment(4, 'Completed'),
  ];

  const courses: Course[] = [
    { id: 1, title: 'Security', category: 'Compliance', format: 'Video', durationHours: 1, description: '', mandatory: true, modules: ['a', 'b'] },
  ];

  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    // The fixtures assume a Friday: the pending request (3–4 days out) lands on
    // next Monday–Tuesday and the sick leave (ends in 2 days) finishes on Sunday.
    // On other weekdays "next week" catches different requests.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 16, 12, 0, 0));
    requests = buildRequests();
    enrollments = buildEnrollments();
    mockCandidateService = { getCandidates: jasmine.createSpy('getCandidates').and.returnValue(of(candidates)) };
    mockTimeOffRequestService = {
      getRequests: jasmine.createSpy('getRequests').and.returnValue(of(requests)),
      approveRequest: jasmine.createSpy('approveRequest').and.returnValue(of({})),
      rejectRequest: jasmine.createSpy('rejectRequest').and.returnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: EmployeeService, useValue: { getEmployees: () => of(employees) } },
        { provide: TimeOffRequestService, useValue: mockTimeOffRequestService },
        { provide: CandidateService, useValue: mockCandidateService },
        { provide: EnrollmentService, useValue: { getEnrollments: () => of(enrollments) } },
        { provide: CourseService, useValue: { getCourses: () => of(courses) } },
        { provide: EnrollmentService, useValue: { getEnrollments: () => of(enrollments) } },
        { provide: AuthService, useValue: { currentUser } },
      ],
    }).compileComponents();

    render('HR Administrator');
  });

  afterEach(() => jasmine.clock().uninstall());

  /** Renders Home for someone signed in with `role`. */
  const render = (role: DemoRole, employeeId?: number) => {
    grantRole(role);
    currentUser.set({ name: 'Alex Morgan', email: '', role, ...(employeeId ? { employeeId } : {}) });
    mockCandidateService.getCandidates.calls.reset();
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  };
  const tabs = () => Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>);
  const tabLabels = () => tabs().map((t) => t.textContent!.replace(/\s+/g, ' ').trim());
  const actionLabels = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.page-actions a') as NodeListOf<HTMLElement>).map((a) => a.textContent!.trim());

  it('should greet the signed-in user by first name', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent).toMatch(/Good (morning|afternoon|evening), Alex/);
  });

  it('should list what needs a decision, with its cover impact', () => {
    const rows = fixture.nativeElement.querySelectorAll('.row-item');
    // One pending request plus one overdue course.
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('First1 Last1');
    expect(rows[0].textContent).toContain('Vacation');
    // The only other Developer is out on different days, so nothing collides.
    expect(rows[0].textContent).toContain('No clashes');
  });

  it('should flag a request that starts within a few days as a warning, with its glyph', () => {
    const badge = fixture.nativeElement.querySelector('.row-item .badge');
    expect(badge.textContent).toContain('Starts in 3 days');
    expect(badge.classList).toContain('badge-warning');
    // Status never relies on hue alone.
    expect(badge.querySelector('app-status-icon svg')).not.toBeNull();
  });

  it('should put overdue training in the queue', () => {
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.row-item') as NodeListOf<HTMLElement>);
    const training = rows.find((row) => row.textContent!.includes('Training overdue'))!;
    expect(training).toBeTruthy();
    expect(training.textContent).toContain('Security');
    expect(training.querySelector('.badge')!.textContent).toContain('Overdue');
    expect(training.querySelector('.badge')!.classList).toContain('badge-critical');
  });

  it('should split the queue by kind with counted tabs', () => {
    expect(tabLabels()).toEqual(['All 2', 'Time off 1', 'Hiring 0', 'Training 1']);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');

    tabs()[3].click();
    fixture.detectChanges();

    expect(tabs()[3].getAttribute('aria-selected')).toBe('true');
    const rows = fixture.nativeElement.querySelectorAll('.row-item');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Training overdue');
  });

  it('should move between tabs with the arrow keys', () => {
    tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');

    tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(tabs()[3].getAttribute('aria-selected')).toBe('true');
  });

  it('should say who is out today and why', () => {
    const alert = fixture.nativeElement.querySelector('.acme-alert');
    expect(alert.querySelector('.acme-alert__title').textContent).toContain('1 person is out today');
    expect(alert.textContent).toContain('First2 Last2 (sick leave until');
  });

  it('should show who is out next week, marking what is still pending', () => {
    const bars = fixture.nativeElement.querySelectorAll('.timeline.week .t-bar');
    expect(bars.length).toBe(1);
    expect(bars[0].textContent).toContain('Pending');
    expect(bars[0].classList).toContain('is-pending');
  });

  it('should break headcount down by position, highlighting the largest', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.bars .b-label') as NodeListOf<HTMLElement>)
      .map((l) => l.textContent!.trim());
    const values = Array.from(fixture.nativeElement.querySelectorAll('.bars .b-value') as NodeListOf<HTMLElement>)
      .map((v) => v.textContent!.trim());
    expect(labels).toEqual(['Developer', 'Designer', 'QA', 'Manager']);
    expect(values).toEqual(['2', '0', '1', '0']);

    // Blue marks exactly one takeaway: the biggest group.
    const highlighted = fixture.nativeElement.querySelectorAll('.bars .meter > .is-highlight');
    expect(highlighted.length).toBe(1);
  });

  it('should count candidates per pipeline stage', () => {
    const cells = Array.from(fixture.nativeElement.querySelectorAll('.pipeline li') as NodeListOf<HTMLElement>)
      .map((li) => `${li.querySelector('span')!.textContent!.trim()} ${li.querySelector('strong')!.textContent!.trim()}`);
    expect(cells).toEqual(['New 2', 'Interview 0', 'Feedback 0', 'Offer 0', 'Onboarding 1']);
  });

  it('should approve a pending request and reload the figures', () => {
    mockTimeOffRequestService.getRequests.calls.reset();
    const approve = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent!.trim() === 'Approve')!;
    approve.click();

    expect(mockTimeOffRequestService.approveRequest).toHaveBeenCalledWith(1);
    expect(mockTimeOffRequestService.getRequests).toHaveBeenCalledTimes(1);

    fixture.detectChanges();
    const saved = fixture.nativeElement.querySelector('.acme-alert--success');
    expect(saved.textContent).toContain("Approved First1 Last1's vacation.");
  });

  describe('for other roles', () => {
    it('should show an employee only their own overdue training, with nothing to approve', () => {
      render('Employee', 1);

      const rows = fixture.nativeElement.querySelectorAll('.row-item');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Training overdue');
      expect(tabLabels()).toEqual(['All 1', 'Training 1']);
      expect(fixture.nativeElement.querySelector('.row-item button')).toBeNull();
    });

    it('should let an employee request time off but not add people or see hiring', () => {
      render('Employee', 1);

      expect(actionLabels()).toEqual(['Request time off']);
      expect(fixture.nativeElement.querySelector('#pipeline-title')).toBeNull();
      // Candidates are off limits, so they are not even fetched.
      expect(mockCandidateService.getCandidates).not.toHaveBeenCalled();
      expect(text()).toContain('Waiting for approval');
    });

    it('should leave someone else\'s overdue training off an employee\'s queue', () => {
      render('Employee', 3);
      expect(fixture.nativeElement.querySelectorAll('.row-item').length).toBe(0);
      expect(text()).toContain('Nothing waiting on you');
    });

    it('should show a recruiter hiring but no time off or training decisions', () => {
      render('Recruiter');

      expect(tabLabels()).toEqual(['All 0', 'Hiring 0']);
      expect(actionLabels()).toEqual(['Add person']);
      expect(fixture.nativeElement.querySelector('#pipeline-title')).not.toBeNull();
      expect(mockCandidateService.getCandidates).toHaveBeenCalled();
    });

    it('should show a team lead time off approvals and the team\'s training, but not "Add person"', () => {
      render('Team Lead', 9);

      expect(tabLabels()).toEqual(['All 2', 'Time off 1', 'Hiring 0', 'Training 1']);
      expect(actionLabels()).toEqual(['Request time off']);
    });

    it("should keep another team's requests and training off a lead's queue", () => {
      // Nobody in the list reports to lead 5.
      render('Team Lead', 5);

      expect(tabLabels()).toEqual(['All 0', 'Time off 0', 'Hiring 0', 'Training 0']);
      expect(text()).toContain('Nothing waiting on you');
    });

    it('should show the learning coordinator overdue training for everyone', () => {
      render('Learning Coordinator');

      expect(tabLabels()).toEqual(['All 1', 'Training 1']);
    });
  });

  it('should say why when the API refuses an approval', () => {
    mockTimeOffRequestService.approveRequest.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422, error: { message: 'This needs 2 days of vacation in 2026, and only 1 of 25 are left.' },
    })));
    const approve = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent!.trim() === 'Approve')!;
    approve.click();
    fixture.detectChanges();

    expect(text()).toContain('only 1 of 25 are left');
    expect(fixture.nativeElement.querySelector('.acme-alert--success')).toBeNull();
  });
});
