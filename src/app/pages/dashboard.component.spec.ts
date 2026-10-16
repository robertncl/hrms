import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { EmployeeService } from '../services/employee.service';
import { TimeOffRequestService } from '../services/time-off-request.service';
import { CandidateService } from '../services/candidate.service';
import { AuthService } from '../services/auth.service';
import { Employee } from '../infrastructure/types/employee';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { Candidate } from '../infrastructure/types/candidate';
import { daysFromToday } from '../demo/demo-data';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let mockTimeOffRequestService: { getRequests: jasmine.Spy; approveRequest: jasmine.Spy; rejectRequest: jasmine.Spy };

  const employee = (id: number, position: Employee['position'], isAvailable = true): Employee => ({
    id, firstName: `First${id}`, lastName: `Last${id}`, email: '', position, level: 'Senior', isAvailable, profilePicture: '',
  });
  const employees = [employee(1, 'Developer'), employee(2, 'Developer', false), employee(3, 'QA')];
  const requests: TimeOffRequest[] = [
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

  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
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
        { provide: CandidateService, useValue: { getCandidates: () => of(candidates) } },
        { provide: AuthService, useValue: { currentUser: signal({ name: 'Alex Morgan', email: '', role: '' }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  it('should greet the signed-in user by first name', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent).toMatch(/Good (morning|afternoon|evening), Alex/);
  });

  it('should list what needs a decision, with its cover impact', () => {
    const rows = fixture.nativeElement.querySelectorAll('.row-item');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('First1 Last1');
    expect(rows[0].textContent).toContain('Vacation');
    // The only other Developer is out on different days, so nothing collides.
    expect(rows[0].textContent).toContain('No clashes');
  });

  it('should flag a request that starts within a few days', () => {
    const badge = fixture.nativeElement.querySelector('.row-item .badge');
    expect(badge.textContent).toContain('Starts in 3 days');
    expect(badge.classList).toContain('badge-critical');
  });

  it('should split the queue by kind', () => {
    const chips = Array.from(fixture.nativeElement.querySelectorAll('.chips .chip') as NodeListOf<HTMLElement>)
      .map((c) => c.textContent!.replace(/\s+/g, ' ').trim());
    expect(chips).toEqual(['All 1', 'Time off 1', 'Hiring 0']);
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

    // Cobalt marks exactly one takeaway: the biggest group.
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
  });
});
