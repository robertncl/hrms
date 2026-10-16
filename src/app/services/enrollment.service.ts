import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { Enrollment } from '../infrastructure/types/course';

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly http = inject(HttpClient);

  getEnrollments() {
    return this.http.get<Enrollment[]>('/enrollments');
  }

  getEnrollmentsByCourse(courseId: number) {
    return this.http.get<Enrollment[]>(`/enrollments?courseId=${courseId}`);
  }

  getEnrollmentsByEmployee(employeeId: number) {
    return this.http.get<Enrollment[]>(`/enrollments?employeeId=${employeeId}`);
  }

  /** Assigns a course to several employees at once. */
  assign(courseId: number, employeeIds: number[], dueDate?: string) {
    if (!employeeIds.length) {
      return of([] as Enrollment[]);
    }
    return forkJoin(
      employeeIds.map((employeeId) =>
        this.http.post<Enrollment>('/enrollments', {
          courseId,
          employeeId,
          ...(dueDate ? { dueDate } : {}),
        }),
      ),
    );
  }

  /** Records how many modules are done; the API derives status and progress. */
  setCompletedModules(id: number, completedModules: number) {
    return this.http.patch<Enrollment>(`/enrollments/${id}`, { completedModules });
  }

  unenroll(id: number) {
    return this.http.delete(`/enrollments/${id}`);
  }
}
