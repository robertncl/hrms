import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { IMAGE_LOADER } from '@angular/common';
import { of } from 'rxjs';
import { ProjectCardComponent } from './project-card.component';
import { ProjectService } from 'src/app/services/project.service';
import { Project } from 'src/app/infrastructure/types/project';
import { imageLoader } from 'src/app/app.config';

describe('ProjectCardComponent', () => {
  let component: ProjectCardComponent;
  let fixture: ComponentFixture<ProjectCardComponent>;
  let mockProjectService: { getProject: jasmine.Spy };

  const mockProject: Project = {
    id: 1,
    name: 'HRMS Revamp',
    description: 'Revamp the HRMS platform',
    image: 'hrms.png',
    employees: [1, 2],
    subProjectIds: [],
  };

  beforeEach(async () => {
    mockProjectService = {
      getProject: jasmine.createSpy('getProject').and.returnValue(of(mockProject)),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectCardComponent],
      providers: [
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: IMAGE_LOADER, useValue: imageLoader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('projectId', 1);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should not render the card before projectId is set', () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.card'))).toBeFalsy();
  });

  it('should fetch the project by id when projectId changes', () => {
    fixture.componentRef.setInput('projectId', 1);
    fixture.detectChanges();

    expect(mockProjectService.getProject).toHaveBeenCalledWith(1);
  });

  it('should render the project name and link once loaded', () => {
    fixture.componentRef.setInput('projectId', 1);
    fixture.detectChanges();

    const link = fixture.debugElement.query(By.css('.card-body a'));
    expect(link.nativeElement.textContent).toContain('HRMS Revamp');
    expect(link.attributes['href']).toBe('/work/projects/1');
  });

  it('should re-fetch the project when projectId changes to a new value', () => {
    fixture.componentRef.setInput('projectId', 1);
    fixture.detectChanges();

    fixture.componentRef.setInput('projectId', 2);
    fixture.detectChanges();

    expect(mockProjectService.getProject).toHaveBeenCalledWith(2);
    expect(mockProjectService.getProject).toHaveBeenCalledTimes(2);
  });
});
