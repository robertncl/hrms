import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DemoBackend, demoBackendInterceptor } from './demo-backend';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, ROLE_PERMISSIONS, createDemoDatabase, daysFromToday, workEmail } from './demo-data';
import { ALL_PERMISSION_NAMES } from '../infrastructure/types/permissions';
import { Employee } from '../infrastructure/types/employee';
import { Project } from '../infrastructure/types/project';
import { Candidate } from '../infrastructure/types/candidate';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { Course, Enrollment } from '../infrastructure/types/course';

describe('DemoBackend', () => {
  let http: HttpClient;
  let backend: DemoBackend;
  const seed = createDemoDatabase();

  /** The session the next request carries, like the app's auth interceptor. */
  let token: string | null = null;
  const withToken: HttpInterceptorFn = (req, next) =>
    next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);

  type Session = { token: string; user: { name: string; role: string; employeeId?: number }; permissions: Record<string, boolean> };
  const signIn = async (email: string, password = DEMO_PASSWORD) => {
    token = null;
    const session = await firstValueFrom(http.post<Session>('/api/auth/login', { email, password }));
    token = session.token;
    return session;
  };

  const request = <T>(observable: Observable<T>) => firstValueFrom(observable);
  const expectError = async (promise: Promise<unknown>, status: number) => {
    try {
      await promise;
      fail(`expected HTTP ${status}`);
    } catch (error) {
      expect((error as HttpErrorResponse).status).toBe(status);
    }
  };

  beforeEach(async () => {
    localStorage.clear();
    token = null;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([withToken, demoBackendInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(DemoBackend);
    backend.latency = 0;
    // Most tests work as HR, who may do everything.
    await signIn('admin@acme.com');
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
      '/api/auth/login', { email: 'ADMIN@acme.com', password: DEMO_PASSWORD },
    ));
    expect(response.token).toBeTruthy();
    expect(response.user.role).toBe('HR Administrator');
    expect(response.permissions).toEqual(jasmine.objectContaining({ DeleteEmployee: true }));
    expect('password' in response.user).toBeFalse();
  });

  it('should reject a wrong password', async () => {
    await expectError(request(http.post('/api/auth/login', { email: 'admin@acme.com', password: 'nope' })), 401);
  });

  it('should register a new account that can then log in', async () => {
    await request(http.post('/api/auth/register', { email: 'new@acme.com', password: 'pw' }));
    await expectError(request(http.post('/api/auth/register', { email: 'new@acme.com', password: 'pw' })), 409);

    const response = await request(http.post<{ token: string }>('/api/auth/login', { email: 'new@acme.com', password: 'pw' }));
    expect(response.token).toBeTruthy();
  });

  it('should persist changes and restore the seed on reset', async () => {
    await request(http.delete('/employees/1'));
    expect(JSON.parse(localStorage.getItem('acme-people-db')!).employees.length).toBe(seed.employees.length - 1);

    backend.reset();
    const employees = await request(http.get<Employee[]>('/employees'));
    expect(employees.length).toBe(seed.employees.length);
  });

  it('should pass through requests it does not own', () => {
    expect(backend.handle({ urlWithParams: '/assets/x.json', url: '/assets/x.json', method: 'GET' } as any)).toBeNull();
  });

  it('should build plain ASCII work emails from names', () => {
    expect(workEmail('James', "O'Connor")).toBe('james.oconnor@acme.com');
    expect(workEmail('Amelia', 'García')).toBe('amelia.garcia@acme.com');
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
      const stored = JSON.parse(localStorage.getItem('acme-people-db')!).enrollments.find((e: Enrollment) => e.id === created.id);
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
      localStorage.setItem('acme-people-db', JSON.stringify(old));

      const migrated = TestBed.runInInjectionContext(() => new DemoBackend());
      const db = JSON.parse(JSON.stringify((migrated as unknown as { db: typeof seed }).db)) as typeof seed;
      expect(db.employees.length).toBe(seed.employees.length - 1);
      expect(db.courses.length).toBe(seed.courses.length);
      expect(db.enrollments.some(e => e.employeeId === 3)).toBeFalse();
      expect(db.enrollments.length).toBeGreaterThan(0);
    });
  });

  describe('demo accounts', () => {
    it('should sign every built-in account in with the shared password and its role\'s permissions', async () => {
      for (const account of DEMO_ACCOUNTS) {
        const session = await signIn(account.email);
        expect(session.user.role).withContext(account.email).toBe(account.role);
        // Every permission is spelled out, so nothing is inherited from a previous sign-in.
        expect(Object.keys(session.permissions).sort()).toEqual([...ALL_PERMISSION_NAMES].sort());
        const granted = ALL_PERMISSION_NAMES.filter((name) => session.permissions[name]);
        expect(granted.sort()).withContext(account.email).toEqual([...ROLE_PERMISSIONS[account.role]].sort());
      }
    });

    it('should link the team lead and the employee to their People records', async () => {
      const employees = await request(http.get<Employee[]>('/employees'));
      for (const account of DEMO_ACCOUNTS.filter((a) => a.employeeId)) {
        const person = employees.find((e) => e.id === account.employeeId)!;
        expect(`${person.firstName} ${person.lastName}`).withContext(account.email).toBe(account.name);
      }
    });

    it('should point old @hrms.demo addresses at the matching @acme.com account', async () => {
      token = null;
      try {
        await request(http.post('/api/auth/login', { email: 'lead@hrms.demo', password: DEMO_PASSWORD }));
        fail('expected 401');
      } catch (error) {
        const { status, error: body } = error as HttpErrorResponse;
        expect(status).toBe(401);
        expect(body.message).toContain('lead@acme.com');
        expect(body.message).toContain(DEMO_PASSWORD);
      }
    });

    it('should keep working when saved data holds stale copies of the built-in accounts', async () => {
      const stale = createDemoDatabase() as unknown as { users: object[] };
      stale.users = [
        { name: 'Alex Morgan', email: 'admin@acme.com', role: 'HR Administrator', password: 'old', permissions: {} },
        { name: 'Sam Rivera', email: 'lead@hrms.demo', role: 'Team Lead', password: 'demo', permissions: {} },
        { name: 'me', email: 'me@example.com', role: 'HR Administrator', password: 'pw', permissions: {} },
      ];
      localStorage.setItem('acme-people-db', JSON.stringify(stale));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(withInterceptors([withToken, demoBackendInterceptor]))],
      });
      http = TestBed.inject(HttpClient);
      TestBed.inject(DemoBackend).latency = 0;

      const admin = await signIn('admin@acme.com');
      expect(admin.permissions['DeleteEmployee']).toBeTrue();
      const registered = await signIn('me@example.com', 'pw');
      expect(registered.user.role).toBe('HR Administrator');

      const saved = JSON.parse(localStorage.getItem('acme-people-db')!).users as { email: string; permissions?: object }[];
      expect(saved.map((u) => u.email)).toEqual(['me@example.com']);
      expect(saved[0].permissions).toBeUndefined();
    });

    it('should not let anyone register a built-in address', async () => {
      await expectError(request(http.post('/api/auth/register', { email: 'Employee@acme.com', password: 'pw' })), 409);
    });

    it('should describe the session behind a token', async () => {
      await signIn('employee@acme.com');
      const session = await request(http.get<Session>('/api/auth/session'));
      expect(session.user).toEqual(jasmine.objectContaining({ name: 'Charlotte Dubois', role: 'Employee', employeeId: 15 }));
      expect(session.permissions['ApproveTimeOff']).toBeFalse();
    });

    it('should refuse sessions it did not issue', async () => {
      token = 'demo-1f0c-old-style';
      await expectError(request(http.get('/api/auth/session')), 401);
      token = `demo.${btoa('nobody@acme.com')}.abc`;
      await expectError(request(http.get('/api/auth/session')), 401);
      token = null;
      await expectError(request(http.get('/api/auth/session')), 401);
    });

    it('should refuse data requests without a session', async () => {
      token = null;
      await expectError(request(http.get('/employees')), 401);
    });
  });

  describe('permissions', () => {
    const refusal = async (promise: Promise<unknown>) => {
      try {
        await promise;
        return 'allowed';
      } catch (error) {
        const { status, error: body } = error as HttpErrorResponse;
        return `${status} ${body?.message ?? ''}`.trim();
      }
    };

    it('should let an employee read People but change nothing about other people', async () => {
      await signIn('employee@acme.com');
      expect((await request(http.get<Employee[]>('/employees'))).length).toBe(seed.employees.length);
      expect(await refusal(request(http.post('/employees', { firstName: 'X' })))).toBe("403 Your role can't add people.");
      expect(await refusal(request(http.patch('/employees/2', { level: 'Lead' })))).toBe("403 Your role can't edit people.");
      expect(await refusal(request(http.get('/candidates')))).toBe("403 Your role can't work on hiring.");
      expect(await refusal(request(http.post('/courses', { title: 'X' })))).toBe("403 Your role can't change the course catalog.");
    });

    it('should let an employee book and withdraw only their own time off', async () => {
      await signIn('employee@acme.com');
      const own = await request(http.post<TimeOffRequest>('/time-off-requests', {
        employeeId: 15, startDate: daysFromToday(30), endDate: daysFromToday(31), type: 'Vacation',
      }));
      expect(own.status).toBe('Pending');
      expect(await refusal(request(http.post('/time-off-requests', {
        employeeId: 2, startDate: daysFromToday(30), endDate: daysFromToday(31), type: 'Vacation',
      })))).toBe("403 Your role can't approve time off.");
      expect(await refusal(request(http.patch(`/time-off-requests/${own.id}`, { status: 'Approved' })))).toContain('403');
      // Someone else's request (Liam's, id 4) stays out of reach.
      expect(await refusal(request(http.delete('/time-off-requests/4')))).toContain('403');
      expect(await refusal(request(http.delete(`/time-off-requests/${own.id}`)))).toBe('allowed');
    });

    it('should not let an employee withdraw a request once it is decided', async () => {
      const own = await request(http.post<TimeOffRequest>('/time-off-requests', {
        employeeId: 15, startDate: daysFromToday(30), endDate: daysFromToday(31), type: 'Vacation',
      }));
      await request(http.patch(`/time-off-requests/${own.id}`, { status: 'Approved' }));

      await signIn('employee@acme.com');
      expect(await refusal(request(http.delete(`/time-off-requests/${own.id}`)))).toContain('403');
    });

    it('should let an employee record progress on their own training only', async () => {
      await signIn('employee@acme.com');
      const enrollments = await request(http.get<Enrollment[]>('/enrollments'));
      const own = enrollments.find((e) => e.employeeId === 15 && e.status !== 'Completed')!;
      const other = enrollments.find((e) => e.employeeId !== 15)!;

      const updated = await request(http.patch<Enrollment>(`/enrollments/${own.id}`, { completedModules: own.completedModules + 1 }));
      expect(updated.completedModules).toBe(own.completedModules + 1);
      expect(await refusal(request(http.patch(`/enrollments/${other.id}`, { completedModules: 1 })))).toBe("403 Your role can't assign training.");
      expect(await refusal(request(http.patch(`/enrollments/${own.id}`, { dueDate: daysFromToday(90) })))).toContain('403');
      expect(await refusal(request(http.delete(`/enrollments/${own.id}`)))).toContain('403');
      expect(await refusal(request(http.post('/enrollments', { courseId: 4, employeeId: 15 })))).toContain('403');
    });

    it('should let a team lead edit roles but not private details, and not remove people', async () => {
      await signIn('lead@acme.com');
      expect(await refusal(request(http.patch('/employees/2', { level: 'Lead', location: 'Berlin' })))).toBe('allowed');
      expect(await refusal(request(http.patch('/employees/2', { phone: '+44 20 7946 0999' })))).toBe("403 Your role can't change private details.");
      // Sending a private field unchanged is not a change.
      const liam = await request(http.get<Employee>('/employees/2'));
      expect(await refusal(request(http.patch('/employees/2', { firstName: liam.firstName, level: 'Senior' })))).toBe('allowed');
      expect(await refusal(request(http.delete('/employees/2')))).toBe("403 Your role can't remove people.");
      expect(await refusal(request(http.post('/employees', { firstName: 'X' })))).toContain('403');
    });

    it('should let a team lead approve time off, hire and assign training, but not change the catalog', async () => {
      await signIn('lead@acme.com');
      expect(await refusal(request(http.patch('/time-off-requests/4', { status: 'Approved' })))).toBe('allowed');
      expect(await refusal(request(http.get('/candidates')))).toBe('allowed');
      expect(await refusal(request(http.post('/enrollments', { courseId: 4, employeeId: 2 })))).toBe('allowed');
      expect(await refusal(request(http.patch('/courses/1', { title: 'X' })))).toContain('403');
    });

    it('should let a recruiter hire and add people, and nothing else', async () => {
      await signIn('recruiter@acme.com');
      expect(await refusal(request(http.patch('/candidates/1', { status: 'Interview preparation' })))).toBe('allowed');
      expect(await refusal(request(http.post('/employees', {
        firstName: 'New', lastName: 'Hire', email: 'n@h.acme', position: 'QA', level: 'Junior',
      })))).toBe('allowed');
      expect(await refusal(request(http.patch('/employees/2', { level: 'Lead' })))).toContain('403');
      expect(await refusal(request(http.patch('/time-off-requests/4', { status: 'Approved' })))).toContain('403');
      expect(await refusal(request(http.post('/enrollments', { courseId: 4, employeeId: 2 })))).toContain('403');
    });

    it('should let a learning coordinator run the catalog and assign training, and nothing else', async () => {
      await signIn('learning@acme.com');
      const course = await request(http.post<Course>('/courses', {
        title: 'Fire Safety', category: 'Compliance', format: 'Video', durationHours: 1, description: 'x', modules: ['a'],
      }));
      expect(course.id).toBeGreaterThan(0);
      expect(await refusal(request(http.post('/enrollments', { courseId: course.id, employeeId: 2 })))).toBe('allowed');
      expect(await refusal(request(http.get('/candidates')))).toContain('403');
      expect(await refusal(request(http.patch('/time-off-requests/4', { status: 'Approved' })))).toContain('403');
      expect(await refusal(request(http.patch('/employees/2', { level: 'Lead' })))).toContain('403');
    });
  });

  describe('employee details', () => {
    it('should give every seeded person a start date, location, phone and personal email', async () => {
      const employees = await request(http.get<Employee[]>('/employees'));
      for (const person of employees) {
        expect(person.startDate).withContext(person.firstName).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(person.startDate! <= daysFromToday(0)).withContext(person.firstName).toBeTrue();
        expect(['London', 'Lisbon', 'Berlin', 'Remote']).withContext(person.firstName).toContain(person.location!);
        expect(person.phone).withContext(person.firstName).toMatch(/^\+44 20 7946 0\d{3}$/);
        expect(person.personalEmail).withContext(person.firstName).toMatch(/@example\.com$/);
      }
    });

    it('should give everyone but the two heads of team a manager who exists', async () => {
      const employees = await request(http.get<Employee[]>('/employees'));
      const ids = new Set(employees.map((e) => e.id));
      const heads = employees.filter((e) => !e.managerId).map((e) => e.firstName);
      expect(heads.sort()).toEqual(['Olivia', 'Sophia']);
      expect(employees.every((e) => !e.managerId || ids.has(e.managerId))).toBeTrue();
    });

    it('should fill details into seeded people saved before details existed', () => {
      const old = createDemoDatabase();
      old.employees = old.employees.map(({ startDate, location, managerId, phone, personalEmail, ...rest }) => rest);
      old.employees[1] = { ...old.employees[1], firstName: 'Renamed' };
      localStorage.setItem('acme-people-db', JSON.stringify(old));

      const migrated = TestBed.runInInjectionContext(() => new DemoBackend());
      const employees = (migrated as unknown as { db: { employees: Employee[] } }).db.employees;
      expect(employees[0].location).toBe(seed.employees[0].location);
      expect(employees[2].managerId).toBe(seed.employees[2].managerId);
      // Somebody the visitor changed is left exactly as they left it.
      expect(employees[1].firstName).toBe('Renamed');
      expect(employees[1].startDate).toBeUndefined();
    });
  });
});
