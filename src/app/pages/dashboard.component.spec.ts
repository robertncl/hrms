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

  it('should show the key figures', () => {
    const values = Array.from(fixture.nativeElement.querySelectorAll('.stat') as NodeListOf<HTMLElement>).map((stat) => [
      stat.querySelector('.stat-label')!.textContent!.trim(),
      stat.querySelector('.stat-value')!.textContent!.trim(),
    ]);
    expect(values).toEqual([
      ['Headcount', '3'],
      ['Away today', '1'],
      ['Pending requests', '1'],
      ['Active candidates', '3'],
    ]);
  });

  it('should only list approved absences in the next two weeks', () => {
    expect(text()).toContain('First2 Last2');
    expect(fixture.nativeElement.querySelectorAll('section.card')[1].textContent).not.toContain('First3 Last3');
  });

  it('should chart headcount by position', () => {
    const bars = fixture.nativeElement.querySelectorAll('section.card')[2].querySelectorAll('li');
    expect(Array.from(bars as NodeListOf<HTMLElement>).map((li) => `${li.querySelector('.label')!.textContent!.trim()} ${li.querySelector('.value')!.textContent!.trim()}`))
      .toEqual(['Developer 2', 'Designer 0', 'QA 1', 'Manager 0']);
  });

  it('should count candidates per pipeline stage', () => {
    const bars = fixture.nativeElement.querySelectorAll('section.card')[3].querySelectorAll('li');
    expect(Array.from(bars as NodeListOf<HTMLElement>).map((li) => `${li.querySelector('.label')!.textContent!.trim()} ${li.querySelector('.value')!.textContent!.trim()}`))
      .toEqual(['CV evaluation 2', 'Interview preparation 0', 'Interview Feedback 0', 'Offer sent 0', 'Onboarding 1']);
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
