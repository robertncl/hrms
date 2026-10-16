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
  };

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
        { provide: EmployeeService, useValue: { getEmployees: () => of([mockEmployee]) } },
        { provide: TimeOffRequestService, useValue: { getRequests: () => of([]) } },
        { provide: EnrollmentService, useValue: mockEnrollmentService },
        {
          provide: CourseService,
          useValue: { getCourses: () => of([course(1, 'Security'), course(2, 'Privacy')]) },
        },
        { provide: IMAGE_LOADER, useValue: imageLoader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeDetailsComponent);
    component = fixture.componentInstance;
    component.employee = mockEmployee;
    fixture.detectChanges();
  });

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
});
