import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { EnrollmentService } from './enrollment.service';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EnrollmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch all enrollments', () => {
    service.getEnrollments().subscribe();
    httpMock.expectOne('/enrollments').flush([]);
  });

  it('should fetch enrollments by course and by employee', () => {
    service.getEnrollmentsByCourse(3).subscribe();
    service.getEnrollmentsByEmployee(7).subscribe();
    httpMock.expectOne('/enrollments?courseId=3').flush([]);
    httpMock.expectOne('/enrollments?employeeId=7').flush([]);
  });

  it('should assign a course to each employee', () => {
    let result: unknown;
    service.assign(2, [4, 5], '2026-12-01').subscribe((enrollments) => (result = enrollments));

    const requests = httpMock.match('/enrollments');
    expect(requests.length).toBe(2);
    expect(requests.map((r) => r.request.body)).toEqual([
      { courseId: 2, employeeId: 4, dueDate: '2026-12-01' },
      { courseId: 2, employeeId: 5, dueDate: '2026-12-01' },
    ]);
    requests.forEach((r, i) => r.flush({ id: i + 1 }));
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('should leave out the due date when there is none', () => {
    service.assign(2, [4]).subscribe();
    expect(httpMock.expectOne('/enrollments').request.body).toEqual({ courseId: 2, employeeId: 4 });
  });

  it('should not send anything when no employees are chosen', () => {
    let result: unknown;
    service.assign(2, []).subscribe((enrollments) => (result = enrollments));
    expect(result).toEqual([]);
  });

  it('should record completed modules', () => {
    service.setCompletedModules(9, 3).subscribe();
    const req = httpMock.expectOne('/enrollments/9');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ completedModules: 3 });
    req.flush({});
  });

  it('should unenroll', () => {
    service.unenroll(9).subscribe();
    const req = httpMock.expectOne('/enrollments/9');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
