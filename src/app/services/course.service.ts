import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Course } from '../infrastructure/types/course';

export type NewCourse = Omit<Course, 'id'>;

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);

  getCourses() {
    return this.http.get<Course[]>('/courses');
  }

  getCourse(id: number) {
    return this.http.get<Course>(`/courses/${id}`);
  }

  createCourse(course: NewCourse) {
    return this.http.post<Course>('/courses', course);
  }

  updateCourse(id: number, changes: Partial<Course>) {
    return this.http.patch<Course>(`/courses/${id}`, changes);
  }

  deleteCourse(id: number) {
    return this.http.delete(`/courses/${id}`);
  }
}
