import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjectListComponent } from './project-list.component';
import { ProjectService } from 'src/app/services/project.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { Project } from 'src/app/infrastructure/types/project';
import { Employee } from 'src/app/infrastructure/types/employee';
import { imageLoader } from 'src/app/app.config';

describe('ProjectListComponent', () => {
  let component: ProjectListComponent;
  let fixture: ComponentFixture<ProjectListComponent>;

  const mockProjects: Project[] = [
    {
      id: 1,
      name: 'Project One',
      description: 'First project',
      image: 'one.png',
      employees: [1, 2],
      subProjectIds: [],
    },
    {
      id: 2,
      name: 'Project Two',
      description: 'Second project',
      image: 'two.png',
      employees: [3],
      subProjectIds: [],
    },
  ];

  const mockEmployees: Employee[] = [
    { id: 1, firstName: 'Ada', lastName: 'Byron', email: 'a@acme.com', position: 'Developer', level: 'Lead', isAvailable: true, profilePicture: '' },
    { id: 2, firstName: 'Alan', lastName: 'Turing', email: 't@acme.com', position: 'Developer', level: 'Senior', isAvailable: false, profilePicture: '' },
    { id: 3, firstName: 'Grace', lastName: 'Hopper', email: 'g@acme.com', position: 'QA', level: 'Senior', isAvailable: true, profilePicture: '' },
  ];

  const mockProjectService = {
    getProjects: jasmine.createSpy('getProjects').and.returnValue(of(mockProjects)),
    getProject: jasmine.createSpy('getProject').and.returnValue(of(mockProjects[0])),
  };

  beforeEach(async () => {
    mockProjectService.getProjects.calls.reset();
    mockProjectService.getProjects.and.returnValue(of(mockProjects));

    await TestBed.configureTestingModule({
      imports: [ProjectListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: EmployeeService, useValue: { getEmployees: () => of(mockEmployees) } },
        { provide: IMAGE_LOADER, useValue: imageLoader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should fetch projects from the ProjectService on construction', () => {
    expect(mockProjectService.getProjects).toHaveBeenCalled();
  });

  it('should render a card for each project', () => {
    fixture.detectChanges();
    const cards = fixture.debugElement.nativeElement.querySelectorAll('.project');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Project One');
    expect(cards[0].textContent).toContain('First project');
  });

  it('should summarise staffing, calling out anyone away', () => {
    fixture.detectChanges();
    const cards = fixture.debugElement.nativeElement.querySelectorAll('.project');
    // Project One has Ada (in) and Alan (away).
    expect(cards[0].textContent).toContain('2 people · 1 away');
    expect(cards[0].querySelector('.badge')?.textContent).toContain('1 away');
    // Project Two has only Grace, who is in.
    expect(cards[1].textContent).toContain('1 person · all in');
    expect(cards[1].querySelector('.badge')).toBeNull();
  });

  it('should render an empty state when there are no projects', () => {
    mockProjectService.getProjects.and.returnValue(of([]));
    fixture = TestBed.createComponent(ProjectListComponent);
    fixture.detectChanges();
    expect(fixture.debugElement.nativeElement.querySelectorAll('.project').length).toBe(0);
    expect(fixture.debugElement.nativeElement.querySelector('.empty-state')).toBeTruthy();
  });
});
