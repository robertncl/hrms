import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailsComponent } from './project-details.component';
import { ProjectService } from 'src/app/services/project.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { TimeOffRequestService } from 'src/app/services/time-off-request.service';
import { Project } from 'src/app/infrastructure/types/project';
import { Employee } from 'src/app/infrastructure/types/employee';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { imageLoader } from 'src/app/app.config';

describe('ProjectDetailsComponent', () => {
  let component: ProjectDetailsComponent;
  let fixture: ComponentFixture<ProjectDetailsComponent>;

  const mockProject: Project = {
    id: 1,
    name: 'Project One',
    description: 'First project',
    image: 'one.png',
    employees: [1, 2],
    subProjectIds: [2, 3],
  };

  const subProjects: Project[] = [
    { id: 2, name: 'Sub Two', description: '', image: '', employees: [1], subProjectIds: [] },
    { id: 3, name: 'Sub Three', description: '', image: '', employees: [], subProjectIds: [] },
  ];

  const employees: Employee[] = [
    { id: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'a@acme.com', position: 'Developer', level: 'Lead', isAvailable: true, profilePicture: '' },
    { id: 2, firstName: 'Alan', lastName: 'Turing', email: 't@acme.com', position: 'Developer', level: 'Senior', isAvailable: false, profilePicture: '' },
    { id: 9, firstName: 'Not', lastName: 'Member', email: 'n@acme.com', position: 'QA', level: 'Junior', isAvailable: true, profilePicture: '' },
  ];

  // Alan is signed off across today, so the cover warning can name a return date.
  const requests: TimeOffRequest[] = [
    { id: 1, employeeId: 2, startDate: '2000-01-01', endDate: '2099-12-31', type: 'Vacation', status: 'Approved' },
  ];

  let mockProjectService: { getProjects: jasmine.Spy };

  beforeEach(async () => {
    mockProjectService = {
      getProjects: jasmine.createSpy('getProjects').and.returnValue(of([mockProject, ...subProjects])),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectDetailsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: EmployeeService, useValue: { getEmployees: () => of(employees) } },
        { provide: TimeOffRequestService, useValue: { getRequests: () => of(requests) } },
        { provide: IMAGE_LOADER, useValue: imageLoader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load projects when the id input changes', () => {
    component.id = 1;
    component.ngOnChanges({
      id: { currentValue: 1, previousValue: undefined, firstChange: true, isFirstChange: () => true },
    });

    expect(mockProjectService.getProjects).toHaveBeenCalled();
  });

  it('should not load anything if the id input did not change', () => {
    component.id = 1;
    component.ngOnChanges({});

    expect(mockProjectService.getProjects).not.toHaveBeenCalled();
  });

  it('should render the project hero once resolved', () => {
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain('Project One');
    expect(text).toContain('First project');
    const image: HTMLImageElement = fixture.debugElement.nativeElement.querySelector('.hero img');
    expect(image.getAttribute('src')).toBe('one.png');
  });

  it('should list only the employees on the project team', () => {
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    const members = fixture.debugElement.nativeElement.querySelectorAll('.member');
    expect(members.length).toBe(2);
    expect(members[0].textContent).toContain('Ada Lovelace');
    expect(members[1].textContent).toContain('Alan Turing');
  });

  it('should warn how many of the team are away, and name them', () => {
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    const callout = fixture.debugElement.nativeElement.querySelector('.callout-danger');
    expect(callout.textContent).toContain('1 of 2 away right now');
    expect(callout.textContent).toContain('Alan');
  });

  it('should list each sub-project by name', () => {
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    const items = fixture.debugElement.nativeElement.querySelectorAll('.sub-list li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Sub Two');
    expect(items[1].textContent).toContain('Sub Three');
  });

  it('should say so when a project has no sub-projects', () => {
    mockProjectService.getProjects.and.returnValue(of([{ ...mockProject, subProjectIds: [] }]));
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    expect(fixture.debugElement.nativeElement.querySelectorAll('.sub-list li').length).toBe(0);
    expect(fixture.debugElement.nativeElement.textContent).toContain('None yet');
  });
});
