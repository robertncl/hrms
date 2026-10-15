import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EmployeeDetailsComponent } from './employee-details.component';
import { ProjectService } from 'src/app/services/project.service';
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

    await TestBed.configureTestingModule({
      imports: [EmployeeDetailsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: EnrollmentService, useValue: mockEnrollmentService },
        { provide: CourseService, useValue: { getCourses: () => of([course(1, 'Security'), course(2, 'Privacy')]) } },
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

  it('should render a project card per project returned by the service', () => {
    const cards = fixture.debugElement.nativeElement.querySelectorAll('app-project-card');
    expect(cards.length).toBe(mockProjects.length);
  });

  it("should list the employee's training, overdue first", async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockEnrollmentService.getEnrollmentsByEmployee).toHaveBeenCalledWith(mockEmployee.id);
    const items = Array.from(fixture.nativeElement.querySelectorAll('.training-list li') as NodeListOf<HTMLElement>);
    expect(items.map((li) => li.querySelector('a')!.textContent!.trim())).toEqual(['Privacy', 'Security']);
    expect(items[0].querySelector('.badge')!.textContent).toContain('Overdue');
    expect(items[1].textContent).toContain('Completed Jan 10, 2026');
    expect(fixture.nativeElement.querySelector('.training').textContent).toContain('1 of 2 complete');
  });
});
