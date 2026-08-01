import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailsComponent } from './project-details.component';
import { ProjectService } from 'src/app/services/project.service';
import { Project } from 'src/app/infrastructure/types/project';
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

  const mockProjectService = {
    getProject: jasmine.createSpy('getProject').and.returnValue(of(mockProject)),
    getProjects: jasmine.createSpy('getProjects').and.returnValue(of([mockProject])),
  };

  beforeEach(async () => {
    mockProjectService.getProject.calls.reset();
    mockProjectService.getProject.and.returnValue(of(mockProject));

    await TestBed.configureTestingModule({
      imports: [ProjectDetailsComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: IMAGE_LOADER, useValue: imageLoader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.id = 1;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should fetch the project via ProjectService when id input changes', () => {
    component.id = 1;
    component.ngOnChanges({
      id: {
        currentValue: 1,
        previousValue: undefined,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(mockProjectService.getProject).toHaveBeenCalledWith(1);
  });

  it('should not fetch the project if the id input did not change', () => {
    component.id = 1;
    component.ngOnChanges({});

    expect(mockProjectService.getProject).not.toHaveBeenCalled();
  });

  it('should render project details once resolved', () => {
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    const text = fixture.debugElement.nativeElement.textContent;
    expect(text).toContain('Project One');
    expect(text).toContain('First project');
    expect(text).toContain('one.png');
  });

  it('should render a project card for each subproject', () => {
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    const cards = fixture.debugElement.nativeElement.querySelectorAll('app-project-card');
    expect(cards.length).toBe(2);
  });

  it('should render no subproject cards when subProjectIds is empty', () => {
    mockProjectService.getProject.and.returnValue(of({ ...mockProject, subProjectIds: [] }));
    fixture.componentRef.setInput('id', 1);
    fixture.detectChanges();

    const cards = fixture.debugElement.nativeElement.querySelectorAll('app-project-card');
    expect(cards.length).toBe(0);
  });
});
