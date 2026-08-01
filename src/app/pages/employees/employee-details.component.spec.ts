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
});
