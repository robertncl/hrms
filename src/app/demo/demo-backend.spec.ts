import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DemoBackend, demoBackendInterceptor } from './demo-backend';
import { DEMO_PASSWORD, createDemoDatabase, daysFromToday, workEmail } from './demo-data';
import { Employee } from '../infrastructure/types/employee';
import { Project } from '../infrastructure/types/project';
import { Candidate } from '../infrastructure/types/candidate';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { Course, Enrollment } from '../infrastructure/types/course';

describe('DemoBackend', () => {
  let http: HttpClient;
  let backend: DemoBackend;
  const seed = createDemoDatabase();

  const request = <T>(observable: Observable<T>) => firstValueFrom(observable);
  const expectError = async (promise: Promise<unknown>, status: number) => {
    try {
      await promise;
      fail(`expected HTTP ${status}`);
    } catch (error) {
      expect((error as HttpErrorResponse).status).toBe(status);
    }
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([demoBackendInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(DemoBackend);
    backend.latency = 0;
  });

  afterEach(() => localStorage.clear());

  it('should list a collection', async () => {
    const employees = await request(http.get<Employee[]>('/employees'));
    expect(employees.length).toBe(seed.employees.length);
  });

  it('should ignore the API host prefix', async () => {
    const employee = await request(http.get<Employee>('http://localhost:3000/employees/1'));
    expect(employee.firstName).toBe(seed.employees[0].firstName);
  });

  it('should filter with _like as a case-insensitive substring', async () => {
    const candidates = await request(http.get<Candidate[]>('/candidates?firstName_like=zO'));
    expect(candidates.map(c => c.firstName)).toEqual(['Zoe']);
  });

  it('should filter with _like as an array member', async () => {
    const projects = await request(http.get<Project[]>('/projects?employees_like=2'));
    expect(projects.every(p => p.employees.includes(2))).toBeTrue();
    expect(projects.length).toBe(seed.projects.filter(p => p.employees.includes(2)).length);
  });

  it('should return 404 for a missing record', async () => {
    await expectError(request(http.get('/employees/999')), 404);
  });

  it('should create, update and delete records', async () => {
    const created = await request(http.post<Employee>('/employees', {
      firstName: 'Test', lastName: 'User', email: 't@u.demo', position: 'QA', level: 'Junior',
    }));
    expect(created.id).toBe(seed.employees.length + 1);
    expect(created.isAvailable).toBeTrue();

    const updated = await request(http.patch<Employee>(`/employees/${created.id}`, { level: 'Middle' }));
    expect(updated.level).toBe('Middle');
    expect(updated.firstName).toBe('Test');

    await request(http.delete(`/employees/${created.id}`));
    await expectError(request(http.get(`/employees/${created.id}`)), 404);
  });

  it('should remove time off and project membership when an employee is deleted', async () => {
    await request(http.delete('/employees/2'));

    const requests = await request(http.get<TimeOffRequest[]>('/time-off-requests'));
    const projects = await request(http.get<Project[]>('/projects'));
    expect(requests.some(r => r.employeeId === 2)).toBeFalse();
    expect(projects.some(p => p.employees.includes(2))).toBeFalse();
  });

  it('should derive availability from approved time off covering today', async () => {
    const today = daysFromToday(0);
    const created = await request(http.post<TimeOffRequest>('/time-off-requests', {
      employeeId: 1, startDate: today, endDate: today, type: 'Other',
    }));
    expect(created.status).toBe('Pending');
    expect((await request(http.get<Employee>('/employees/1'))).isAvailable).toBeTrue();

    await request(http.patch(`/time-off-requests/${created.id}`, { status: 'Approved' }));
    expect((await request(http.get<Employee>('/employees/1'))).isAvailable).toBeFalse();
  });

  it('should log in a demo account and return its permissions', async () => {
    const response = await request(http.post<{ token: string; user: { role: string }; permissions: object }>(
      '/api/auth/login', { email: 'ADMIN@hrms.demo', password: DEMO_PASSWORD },
    ));
    expect(response.token).toBeTruthy();
    expect(response.user.role).toBe('HR Administrator');
    expect(response.permissions).toEqual(jasmine.objectContaining({ DeleteEmployee: true }));
    expect('password' in response.user).toBeFalse();
  });

  it('should reject a wrong password', async () => {
    await expectError(request(http.post('/api/auth/login', { email: 'admin@hrms.demo', password: 'nope' })), 401);
  });

  it('should register a new account that can then log in', async () => {
    await request(http.post('/api/auth/register', { email: 'new@hrms.demo', password: 'pw' }));
    await expectError(request(http.post('/api/auth/register', { email: 'new@hrms.demo', password: 'pw' })), 409);

    const response = await request(http.post<{ token: string }>('/api/auth/login', { email: 'new@hrms.demo', password: 'pw' }));
    expect(response.token).toBeTruthy();
  });

  it('should persist changes and restore the seed on reset', async () => {
    await request(http.delete('/employees/1'));
    expect(JSON.parse(localStorage.getItem('hrms-demo-db')!).employees.length).toBe(seed.employees.length - 1);

    backend.reset();
    const employees = await request(http.get<Employee[]>('/employees'));
    expect(employees.length).toBe(seed.employees.length);
  });

  it('should pass through requests it does not own', () => {
    expect(backend.handle({ urlWithParams: '/assets/x.json', url: '/assets/x.json', method: 'GET' } as any)).toBeNull();
  });

  it('should build plain ASCII work emails from names', () => {
    expect(workEmail('James', "O'Connor")).toBe('james.oconnor@hrms.demo');
    expect(workEmail('Amelia', 'García')).toBe('amelia.garcia@hrms.demo');
  });

  describe('learning', () => {
    it('should derive enrollment status and progress from completed modules', async () => {
      const course = await request(http.get<Course>('/courses/5'));
      const created = await request(http.post<Enrollment>('/enrollments', { courseId: 5, employeeId: 18 }));
      expect(created.status).toBe('Not started');
      expect(created.progress).toBe(0);

      const started = await request(http.patch<Enrollment>(`/enrollments/${created.id}`, { completedModules: 2 }));
      expect(started.status).toBe('In progress');
      expect(started.progress).toBe(Math.round((2 / course.modules.length) * 100));
      expect(started.completedAt).toBeUndefined();

      const done = await request(http.patch<Enrollment>(`/enrollments/${created.id}`, { completedModules: 99 }));
      expect(done.completedModules).toBe(course.modules.length);
      expect(done.status).toBe('Completed');
      expect(done.progress).toBe(100);
      expect(done.completedAt).toBe(daysFromToday(0));

      const reopened = await request(http.patch<Enrollment>(`/enrollments/${created.id}`, { completedModules: 1 }));
      expect(reopened.completedAt).toBeUndefined();
    });

    it('should not store the derived fields', async () => {
      const created = await request(http.post<Enrollment>('/enrollments', { courseId: 5, employeeId: 18, status: 'Completed' }));
      const stored = JSON.parse(localStorage.getItem('hrms-demo-db')!).enrollments.find((e: Enrollment) => e.id === created.id);
      expect(stored.status).toBeUndefined();
      expect(created.status).toBe('Not started');
    });

    it('should filter enrollments by employee and course', async () => {
      const forEmployee = await request(http.get<Enrollment[]>('/enrollments?employeeId=2'));
      expect(forEmployee.length).toBeGreaterThan(0);
      expect(forEmployee.every(e => e.employeeId === 2)).toBeTrue();

      const forCourse = await request(http.get<Enrollment[]>('/enrollments?courseId=1'));
      expect(forCourse.length).toBe(seed.employees.length);
    });

    it('should reject a duplicate enrollment and an unknown course', async () => {
      await expectError(request(http.post('/enrollments', { courseId: 1, employeeId: 1 })), 409);
      await expectError(request(http.post('/enrollments', { courseId: 999, employeeId: 1 })), 400);
    });

    it('should enroll a new employee in every mandatory course', async () => {
      const created = await request(http.post<Employee>('/employees', {
        firstName: 'New', lastName: 'Hire', email: 'n@h.demo', position: 'QA', level: 'Junior',
      }));
      const enrollments = await request(http.get<Enrollment[]>(`/enrollments?employeeId=${created.id}`));

      const mandatory = seed.courses.filter(c => c.mandatory).map(c => c.id);
      expect(enrollments.map(e => e.courseId).sort()).toEqual(mandatory.sort());
      expect(enrollments.every(e => e.dueDate === daysFromToday(30))).toBeTrue();
    });

    it('should remove enrollments with their employee or course', async () => {
      await request(http.delete('/employees/2'));
      await request(http.delete('/courses/1'));

      const enrollments = await request(http.get<Enrollment[]>('/enrollments'));
      expect(enrollments.some(e => e.employeeId === 2 || e.courseId === 1)).toBeFalse();
    });

    it('should add learning data to demo data saved before it existed', () => {
      const old = createDemoDatabase() as Partial<typeof seed>;
      old.employees = old.employees!.filter(e => e.id !== 3);
      delete old.courses;
      delete old.enrollments;
      localStorage.setItem('hrms-demo-db', JSON.stringify(old));

      const migrated = TestBed.runInInjectionContext(() => new DemoBackend());
      const db = JSON.parse(JSON.stringify((migrated as unknown as { db: typeof seed }).db)) as typeof seed;
      expect(db.employees.length).toBe(seed.employees.length - 1);
      expect(db.courses.length).toBe(seed.courses.length);
      expect(db.enrollments.some(e => e.employeeId === 3)).toBeFalse();
      expect(db.enrollments.length).toBeGreaterThan(0);
    });
  });
});
