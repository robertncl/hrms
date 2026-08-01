import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProjectService } from './project.service';
import { Project } from '../infrastructure/types/project';

describe('ProjectService', () => {
  let service: ProjectService;
  let httpMock: HttpTestingController;

  const mockProject: Project = {
    id: 1,
    name: 'HRMS',
    description: 'HR Management System',
    image: '',
    employees: [1, 2],
    subProjectIds: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProjectService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch a single project by id', () => {
    service.getProject(1).subscribe((project) => {
      expect(project).toEqual(mockProject);
    });

    const req = httpMock.expectOne('/projects/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockProject);
  });

  it('should fetch all projects', () => {
    service.getProjects().subscribe((projects) => {
      expect(projects).toEqual([mockProject]);
    });

    const req = httpMock.expectOne('/projects');
    expect(req.request.method).toBe('GET');
    req.flush([mockProject]);
  });

  it('should fetch projects by employee id', () => {
    service.getProjectsByEmployeeId(1).subscribe((projects) => {
      expect(projects).toEqual([mockProject]);
    });

    const req = httpMock.expectOne('/projects?employees_like=1');
    expect(req.request.method).toBe('GET');
    req.flush([mockProject]);
  });
});
