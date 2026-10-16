import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Course, Enrollment } from 'src/app/infrastructure/types/course';
import { Employee } from 'src/app/infrastructure/types/employee';
import { CourseService } from 'src/app/services/course.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { EnrollmentService } from 'src/app/services/enrollment.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { AuthService } from 'src/app/services/auth.service';
import { daysFromToday } from 'src/app/demo/demo-data';

export const testCourses: Course[] = [
  { id: 1, title: 'Security Basics', category: 'Compliance', format: 'Video', durationHours: 1, description: 'Stay safe online.', mandatory: true, modules: ['Phishing', 'Passwords'] },
  { id: 2, title: 'Angular Workshop', category: 'Technical', format: 'Workshop', durationHours: 8, description: 'Signals and forms.', mandatory: false, modules: ['Signals', 'Forms', 'Testing', 'Routing'] },
  { id: 3, title: 'Leading Teams', category: 'Leadership', format: 'Workshop', durationHours: 4, description: 'Grow your people.', mandatory: false, modules: ['Feedback'] },
];

const employee = (id: number, firstName: string, lastName: string, position: Employee['position']): Employee => ({
  id, firstName, lastName, email: '', position, level: 'Senior', isAvailable: true, profilePicture: '',
});

export const testEmployees: Employee[] = [
  employee(1, 'Ada', 'Lovelace', 'Developer'),
  employee(2, 'Grace', 'Hopper', 'Developer'),
  employee(3, 'Alan', 'Turing', 'QA'),
];

const enrollment = (id: number, courseId: number, employeeId: number, completedModules: number, total: number, dueOffset?: number): Enrollment => ({
  id,
  courseId,
  employeeId,
  assignedAt: daysFromToday(-30),
  completedModules,
  progress: Math.round((completedModules / total) * 100),
  status: completedModules === 0 ? 'Not started' : completedModules >= total ? 'Completed' : 'In progress',
  ...(dueOffset === undefined ? {} : { dueDate: daysFromToday(dueOffset) }),
  ...(completedModules >= total ? { completedAt: daysFromToday(-3) } : {}),
});

export const testEnrollments: Enrollment[] = [
  enrollment(1, 1, 1, 2, 2, -10), // completed
  enrollment(2, 1, 2, 1, 2, -2), // overdue
  enrollment(3, 1, 3, 0, 2, 10), // not started
  enrollment(4, 2, 1, 1, 4, 20), // in progress
];

export function createLearningMocks() {
  return {
    courseService: {
      getCourses: jasmine.createSpy('getCourses').and.returnValue(of(testCourses)),
      getCourse: jasmine.createSpy('getCourse').and.callFake((id: number) => {
        const course = testCourses.find((c) => c.id === id);
        return course ? of(course) : throwError(() => new Error('404'));
      }),
      createCourse: jasmine.createSpy('createCourse').and.returnValue(of({ ...testCourses[0], id: 9 })),
      updateCourse: jasmine.createSpy('updateCourse').and.callFake((id: number) => of({ ...testCourses[0], id })),
      deleteCourse: jasmine.createSpy('deleteCourse').and.returnValue(of({})),
    },
    enrollmentService: {
      getEnrollments: jasmine.createSpy('getEnrollments').and.returnValue(of(testEnrollments)),
      getEnrollmentsByCourse: jasmine.createSpy('getEnrollmentsByCourse').and.callFake((courseId: number) =>
        of(testEnrollments.filter((e) => e.courseId === courseId)),
      ),
      assign: jasmine.createSpy('assign').and.returnValue(of([])),
      setCompletedModules: jasmine.createSpy('setCompletedModules').and.returnValue(of({})),
      unenroll: jasmine.createSpy('unenroll').and.returnValue(of({})),
    },
    employeeService: { getEmployees: () => of(testEmployees) },
  };
}

export type LearningMocks = ReturnType<typeof createLearningMocks>;

/**
 * `canAssign` and `employeeId` describe the viewer: assigners see and manage
 * everyone's training; learners see only their own (`employeeId`).
 */
export function provideLearningTesting(
  mocks: LearningMocks,
  canManage = true,
  canAssign = true,
  employeeId?: number,
): (Provider | EnvironmentProviders)[] {
  const permissions = new PermissionsService();
  permissions.setPermissions({ ManageCourses: canManage, AssignTraining: canAssign });
  const currentUser = signal(employeeId ? { name: 'Test Learner', email: '', role: 'Employee', employeeId } : null);
  return [
    { provide: AuthService, useValue: { currentUser } },
    provideRouter([]),
    { provide: CourseService, useValue: mocks.courseService },
    { provide: EnrollmentService, useValue: mocks.enrollmentService },
    { provide: EmployeeService, useValue: mocks.employeeService },
    { provide: PermissionsService, useValue: permissions },
  ];
}
