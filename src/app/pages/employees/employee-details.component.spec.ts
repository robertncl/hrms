import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EmployeeDetailsComponent } from './employee-details.component';
import { ProjectService } from 'src/app/services/project.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { TimeOffRequestService } from 'src/app/services/time-off-request.service';
import { Employee } from 'src/app/infrastructure/types/employee';
import { Project } from 'src/app/infrastructure/types/project';
import { imageLoader } from 'src/app/app.config';
import { CourseService } from 'src/app/services/course.service';
import { EnrollmentService } from 'src/app/services/enrollment.service';
import { Course, Enrollment } from 'src/app/infrastructure/types/course';
import { signal } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/infrastructure/types/user';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { DemoRole } from 'src/app/demo/demo-data';
import { grantRole } from 'src/testing/roles';
import { formatLongDate } from 'src/app/shared/functions/tenure';

describe('EmployeeDetailsComponent', () => {
  let component: EmployeeDetailsComponent;
  let fixture: ComponentFixture<EmployeeDetailsComponent>;

  const mockEmployee: Employee = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    position: 'Developer',
    level: 'Senior',
    isAvailable: true,
    profilePicture: 'john.png',
    startDate: '2023-03-01',
    location: 'Lisbon',
    managerId: 5,
    phone: '+44 20 7946 0101',
    personalEmail: 'john@example.com',
  };
  const manager: Employee = {
    ...mockEmployee, id: 5, firstName: 'Olivia', lastName: 'Bennett', position: 'Manager', level: 'Lead', managerId: undefined,
  };
  const report: Employee = { ...mockEmployee, id: 7, firstName: 'Ann', lastName: 'Report', managerId: 1 };
  const currentUser = signal<User | null>(null);
  let requests: TimeOffRequest[] = [];

  const mockProjects: Project[] = [
    { id: 1, name: 'Project A', description: '', image: 'a.png', employees: [1], subProjectIds: [] },
    { id: 2, name: 'Project B', description: '', image: 'b.png', employees: [1], subProjectIds: [] },
  ];

  const course = (id: number, title: string): Course => ({
    id, title, category: 'Compliance', format: 'Video', durationHours: 1, description: '', mandatory: true, modules: ['a', 'b'],
  });
  const enrollments: Enrollment[] = [
    { id: 1, courseId: 1, employeeId: 1, assignedAt: '', completedModules: 2, status: 'Completed', progress: 100, completedAt: '2026-01-10' },
    { id: 2, courseId: 2, employeeId: 1, assignedAt: '', completedModules: 1, status: 'In progress', progress: 50, dueDate: '2000-01-01' },
  ];
  const mockEnrollmentService = {
    getEnrollmentsByEmployee: jasmine.createSpy('getEnrollmentsByEmployee').and.returnValue(of(enrollments)),
  };

  const mockProjectService = {
    getProjectsByEmployeeId: jasmine.createSpy('getProjectsByEmployeeId').and.returnValue(of(mockProjects)),
    getProject: jasmine.createSpy('getProject').and.callFake((id: number) =>
      of(mockProjects.find((project) => project.id === id)),
    ),
  };

  beforeEach(async () => {
    mockProjectService.getProjectsByEmployeeId.calls.reset();
    mockProjectService.getProjectsByEmployeeId.and.returnValue(of(mockProjects));
    mockEnrollmentService.getEnrollmentsByEmployee.calls.reset();
    mockEnrollmentService.getEnrollmentsByEmployee.and.returnValue(of(enrollments));

    await TestBed.configureTestingModule({
      imports: [EmployeeDetailsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: EmployeeService, useValue: { getEmployees: () => of([mockEmployee, manager, report]) } },
        { provide: TimeOffRequestService, useValue: { getRequests: () => of(requests) } },
        { provide: AuthService, useValue: { currentUser } },
        { provide: EnrollmentService, useValue: mockEnrollmentService },
        {
          provide: CourseService,
          useValue: { getCourses: () => of([course(1, 'Security'), course(2, 'Privacy')]) },
        },
        { provide: IMAGE_LOADER, useValue: imageLoader },
      ],
    }).compileComponents();

    requests = [];
    render('HR Administrator');
  });

  /** Renders `employee`'s profile for someone signed in with `role`. */
  const render = (role: DemoRole, viewerEmployeeId?: number, employee = mockEmployee) => {
    grantRole(role);
    currentUser.set({ name: 'Viewer', email: '', role, ...(viewerEmployeeId ? { employeeId: viewerEmployeeId } : {}) });
    fixture = TestBed.createComponent(EmployeeDetailsComponent);
    component = fixture.componentInstance;
    component.employee = employee;
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;
  const detail = (term: string) => {
    const dt = Array.from(el().querySelectorAll('dt')).find((d) => d.textContent!.trim() === term);
    return dt?.nextElementSibling?.textContent!.replace(/\s+/g, ' ').trim();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch the projects for the given employee on init', () => {
    expect(mockProjectService.getProjectsByEmployeeId).toHaveBeenCalledWith(mockEmployee.id);
  });

  it('should render the employee details', () => {
    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain(mockEmployee.firstName);
    expect(text).toContain(mockEmployee.lastName);
    expect(text).toContain(mockEmployee.position);
  });

  it('should render a row per project returned by the service', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('.project-row');
    expect(rows.length).toBe(mockProjects.length);
    expect(rows[0].textContent).toContain('Project A');
  });

  it('should show the status as a labelled dot, not colour alone', () => {
    const status = fixture.debugElement.nativeElement.querySelector('.status');
    expect(status.textContent.trim()).toBe('In today');
  });

  it("should list the employee's training, overdue first", async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockEnrollmentService.getEnrollmentsByEmployee).toHaveBeenCalledWith(mockEmployee.id);
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.learning-row') as NodeListOf<HTMLElement>);
    expect(rows.map((row) => row.querySelector('a')!.textContent!.trim())).toEqual(['Privacy', 'Security']);
    expect(rows[0].querySelector('.badge')!.textContent).toContain('Overdue');
    expect(rows[1].textContent).toContain('Completed 10 Jan');

    const card = fixture.nativeElement.querySelector('[aria-labelledby="learning-title"]');
    expect(card.textContent).toContain('1 of 2 complete');
  });

  describe('details', () => {
    it('should show location, start date with tenure, and the reporting line', () => {
      expect(detail('Location')).toBe('Lisbon');
      expect(detail('Started')).toContain(formatLongDate('2023-03-01'));
      expect(detail('Started')).toMatch(/· \d+ years?/);
      expect(detail('Reports to')).toBe('Olivia Bennett');
      expect(el().querySelector('a[href="/employees/details/5"]')).not.toBeNull();
      expect(detail('Direct reports')).toBe('Ann Report');
    });

    it('should leave out direct reports for someone nobody reports to', () => {
      render('HR Administrator', undefined, report);
      expect(detail('Direct reports')).toBeUndefined();
      expect(detail('Reports to')).toBe('John Doe');
    });

    it('should reload when moving to another profile in place', () => {
      mockProjectService.getProjectsByEmployeeId.calls.reset();
      component.employee = manager;
      fixture.detectChanges();

      expect(mockProjectService.getProjectsByEmployeeId).toHaveBeenCalledWith(5);
      expect(el().querySelector('h1')!.textContent).toContain('Olivia Bennett');
      expect(detail('Direct reports')).toBe('John Doe');
    });
  });

  describe('private details', () => {
    it('should show HR the private details', () => {
      expect(el().textContent).toContain('Private details');
      expect(detail('Phone')).toBe('+44 20 7946 0101');
      expect(detail('Personal email')).toBe('john@example.com');
    });

    it('should show people their own private details', () => {
      render('Employee', 1);
      expect(detail('Phone')).toBe('+44 20 7946 0101');
      expect(el().textContent).toContain('Only you and HR see these');
    });

    it("should hide someone else's private details from a team lead", () => {
      render('Team Lead', 5);
      expect(el().textContent).not.toContain('Private details');
      expect(detail('Phone')).toBeUndefined();
    });
  });

  describe('by role', () => {
    const pending: TimeOffRequest = {
      id: 9, employeeId: 1, startDate: '2099-01-02', endDate: '2099-01-03', type: 'Vacation', status: 'Pending',
    };

    it('should offer "Edit details" to roles that can edit people', () => {
      expect(el().querySelector('a[href="/employees/edit/1"]')).not.toBeNull();
      render('Team Lead', 5);
      expect(el().querySelector('a[href="/employees/edit/1"]')).not.toBeNull();
      render('Employee', 1);
      expect(el().querySelector('a[href="/employees/edit/1"]')).toBeNull();
    });

    it('should let an approver decide a pending request from the profile', () => {
      requests = [pending];
      render('Team Lead', 5);
      expect(el().querySelector('.callout')).not.toBeNull();
      expect(el().textContent).toContain('Waiting on you');
    });

    it("should show a person their own pending request as waiting, with nothing to decide", () => {
      requests = [pending];
      render('Employee', 1);
      expect(el().querySelector('.callout')).toBeNull();
      expect(el().textContent).toContain('Waiting for approval');
    });
  });
});
