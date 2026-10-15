import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CourseService } from './course.service';
import { Course } from '../infrastructure/types/course';

describe('CourseService', () => {
  let service: CourseService;
  let httpMock: HttpTestingController;

  const course: Course = {
    id: 1,
    title: 'Security',
    category: 'Compliance',
    format: 'Video',
    durationHours: 1,
    description: '',
    mandatory: true,
    modules: ['One'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch all courses', () => {
    service.getCourses().subscribe((courses) => expect(courses).toEqual([course]));
    const req = httpMock.expectOne('/courses');
    expect(req.request.method).toBe('GET');
    req.flush([course]);
  });

  it('should fetch one course', () => {
    service.getCourse(1).subscribe((result) => expect(result).toEqual(course));
    httpMock.expectOne('/courses/1').flush(course);
  });

  it('should create a course', () => {
    const { id, ...newCourse } = course;
    service.createCourse(newCourse).subscribe();
    const req = httpMock.expectOne('/courses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newCourse);
    req.flush(course);
  });

  it('should update a course', () => {
    service.updateCourse(1, { mandatory: false }).subscribe();
    const req = httpMock.expectOne('/courses/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ mandatory: false });
    req.flush(course);
  });

  it('should delete a course', () => {
    service.deleteCourse(1).subscribe();
    const req = httpMock.expectOne('/courses/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
