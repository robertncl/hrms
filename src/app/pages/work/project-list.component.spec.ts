import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { of } from 'rxjs';
import { ProjectListComponent } from './project-list.component';
import { ProjectService } from 'src/app/services/project.service';
import { Project } from 'src/app/infrastructure/types/project';
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
        { provide: ProjectService, useValue: mockProjectService },
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

  it('should render a project card for each project', () => {
    fixture.detectChanges();
    const cards = fixture.debugElement.nativeElement.querySelectorAll('app-project-card');
    expect(cards.length).toBe(2);
  });

  it('should render no project cards when there are no projects', () => {
    mockProjectService.getProjects.and.returnValue(of([]));
    fixture = TestBed.createComponent(ProjectListComponent);
    fixture.detectChanges();
    const cards = fixture.debugElement.nativeElement.querySelectorAll('app-project-card');
    expect(cards.length).toBe(0);
  });
});
