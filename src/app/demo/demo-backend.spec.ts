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
import { LeaveBalance, nextWorkingDay } from '../shared/functions/leave';
import { PayBand, SalaryChange, SharePrice, StockGrant } from '../infrastructure/types/compensation';
import { currencyFor, currentSalary } from '../shared/functions/pay';
import { sharePriceOn, vestedShares } from '../shared/functions/equity';

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
    // A week around today always holds a working day, and this type has no balance to run out.
    const created = await request(http.post<TimeOffRequest>('/time-off-requests', {
      employeeId: 1, startDate: daysFromToday(-3), endDate: daysFromToday(3), type: 'Maternity Leave',
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
    /** A month out, moved off any weekend or public holiday so it costs exactly one day of leave. */
    const aWorkingDay = nextWorkingDay(daysFromToday(30), 'London');
    const OUTSIDE_TEAM = '403 You can only do this for people who report to you.';

    describe('a team lead, who acts only for their own reporting line', () => {
      // Olivia (1) leads Liam (2) directly and Henry (18) through Evelyn (17).
      // Ava (3) and Harper (13) report to Sophia.
      beforeEach(() => signIn('lead@acme.com'));

      it('should edit direct and indirect reports, but nobody else and not themselves', async () => {
        expect(await refusal(request(http.patch('/employees/2', { level: 'Lead' })))).toBe('allowed');
        expect(await refusal(request(http.patch('/employees/18', { level: 'Senior' })))).toBe('allowed');
        expect(await refusal(request(http.patch('/employees/3', { level: 'Lead' })))).toBe(OUTSIDE_TEAM);
        expect(await refusal(request(http.patch('/employees/1', { level: 'Senior' })))).toBe(OUTSIDE_TEAM);
        expect(await refusal(request(http.put('/employees/3', { ...seed.employees[2], level: 'Lead' })))).toBe(OUTSIDE_TEAM);
      });

      it("should decide their reports' time off, but not another team's", async () => {
        // Request 4 is Liam's; 6 is Harper's.
        expect(await refusal(request(http.patch('/time-off-requests/4', { status: 'Approved' })))).toBe('allowed');
        expect(await refusal(request(http.patch('/time-off-requests/6', { status: 'Approved' })))).toBe(OUTSIDE_TEAM);
        expect(await refusal(request(http.patch('/time-off-requests/6', { status: 'Rejected' })))).toBe(OUTSIDE_TEAM);
        expect(await refusal(request(http.delete('/time-off-requests/6')))).toBe(OUTSIDE_TEAM);
      });

      it('should book for a report, but not for someone on another team', async () => {
        const booking = { startDate: aWorkingDay, endDate: aWorkingDay, type: 'Vacation' };
        expect(await refusal(request(http.post('/time-off-requests', { ...booking, employeeId: 18 })))).toBe('allowed');
        expect(await refusal(request(http.post('/time-off-requests', { ...booking, employeeId: 3 })))).toBe(OUTSIDE_TEAM);
      });

      it('should book their own time off but leave the decision to someone else', async () => {
        const own = await request(http.post<TimeOffRequest>('/time-off-requests', {
          employeeId: 1, startDate: aWorkingDay, endDate: aWorkingDay, type: 'Vacation',
        }));
        expect(await refusal(request(http.patch(`/time-off-requests/${own.id}`, { status: 'Approved' })))).toBe(OUTSIDE_TEAM);
        expect(await refusal(request(http.delete(`/time-off-requests/${own.id}`)))).toBe('allowed');
      });

      it("should not move a report's request onto someone outside the team", async () => {
        expect(await refusal(request(http.patch('/time-off-requests/4', { employeeId: 3 })))).toBe(OUTSIDE_TEAM);
      });

      it('should assign and unassign training within the team only', async () => {
        const assigned = await request(http.post<Enrollment>('/enrollments', { courseId: 4, employeeId: 18 }));
        expect(await refusal(request(http.delete(`/enrollments/${assigned.id}`)))).toBe('allowed');
        expect(await refusal(request(http.post('/enrollments', { courseId: 4, employeeId: 3 })))).toBe(OUTSIDE_TEAM);

        const enrollments = await request(http.get<Enrollment[]>('/enrollments'));
        const other = enrollments.find((e) => e.employeeId === 3)!;
        expect(await refusal(request(http.patch(`/enrollments/${other.id}`, { dueDate: daysFromToday(90) })))).toBe(OUTSIDE_TEAM);
        expect(await refusal(request(http.delete(`/enrollments/${other.id}`)))).toBe(OUTSIDE_TEAM);
      });
    });

    it('should let HR and the learning coordinator act for anyone', async () => {
      // HR decides the request of a lead, who can't decide their own.
      expect(await refusal(request(http.patch('/time-off-requests/6', { status: 'Approved' })))).toBe('allowed');
      expect(await refusal(request(http.patch('/employees/3', { level: 'Lead' })))).toBe('allowed');

      await signIn('learning@acme.com');
      expect(await refusal(request(http.post('/enrollments', { courseId: 4, employeeId: 3 })))).toBe('allowed');
      expect(await refusal(request(http.post('/enrollments', { courseId: 4, employeeId: 18 })))).toBe('allowed');
    });

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
        employeeId: 15, startDate: aWorkingDay, endDate: aWorkingDay, type: 'Vacation',
      }));
      expect(own.status).toBe('Pending');
      expect(await refusal(request(http.post('/time-off-requests', {
        employeeId: 2, startDate: aWorkingDay, endDate: aWorkingDay, type: 'Vacation',
      })))).toBe("403 Your role can't approve time off.");
      expect(await refusal(request(http.patch(`/time-off-requests/${own.id}`, { status: 'Approved' })))).toContain('403');
      // Someone else's request (Liam's, id 4) stays out of reach.
      expect(await refusal(request(http.delete('/time-off-requests/4')))).toContain('403');
      expect(await refusal(request(http.delete(`/time-off-requests/${own.id}`)))).toBe('allowed');
    });

    it('should not let anyone book time off that is already approved', async () => {
      await signIn('employee@acme.com');
      const own = await request(http.post<TimeOffRequest>('/time-off-requests', {
        employeeId: 15, startDate: aWorkingDay, endDate: aWorkingDay, type: 'Vacation', status: 'Approved',
      }));
      expect(own.status).toBe('Pending');
    });

    it('should not let an employee withdraw a request once it is decided', async () => {
      const own = await request(http.post<TimeOffRequest>('/time-off-requests', {
        employeeId: 15, startDate: aWorkingDay, endDate: aWorkingDay, type: 'Vacation',
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
    it("should send phone and personal email only to HR and the person themselves", async () => {
      // HR sees everyone's.
      expect((await request(http.get<Employee>('/employees/2'))).phone).toBeDefined();

      await signIn('employee@acme.com');
      const everyone = await request(http.get<Employee[]>('/employees'));
      const others = everyone.filter((e) => e.id !== 15);
      expect(others.every((e) => e.phone === undefined && e.personalEmail === undefined)).toBeTrue();
      // The directory itself stays complete.
      expect(others.every((e) => !!e.firstName && !!e.email)).toBeTrue();
      const own = everyone.find((e) => e.id === 15)!;
      expect(own.phone).toBeDefined();
      expect(own.personalEmail).toBeDefined();
      expect((await request(http.get<Employee>('/employees/2'))).phone).toBeUndefined();

      // A lead can edit people, but still doesn't get their private details back.
      await signIn('lead@acme.com');
      const updated = await request(http.patch<Employee>('/employees/2', { level: 'Lead' }));
      expect(updated.level).toBe('Lead');
      expect(updated.phone).toBeUndefined();
    });

    it("should not let a filter probe someone else's private details", async () => {
      const liam = await request(http.get<Employee>('/employees/2'));
      await signIn('employee@acme.com');
      expect(await request(http.get<Employee[]>(`/employees?phone=${encodeURIComponent(liam.phone!)}`))).toEqual([]);
      expect(await request(http.get<Employee[]>(`/employees?personalEmail_like=${liam.personalEmail!.slice(0, 4)}`))).toEqual([]);
      // Their own still matches.
      const own = await request(http.get<Employee[]>('/employees?phone_like=7946 0115'));
      expect(own.map((e) => e.id)).toEqual([15]);
    });

    it('should treat a PUT that leaves private details out as changing them', async () => {
      const liam = await request(http.get<Employee>('/employees/2'));
      const { phone, personalEmail, ...rest } = liam;
      await signIn('lead@acme.com');
      await expectError(request(http.put('/employees/2', { ...rest, level: 'Lead' })), 403);

      await signIn('admin@acme.com');
      expect((await request(http.get<Employee>('/employees/2'))).phone).toBe(phone);
    });

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
      old.employees = old.employees.map(({ startDate, location, managerId, phone, personalEmail, department, jobTitle, ...rest }) => rest);
      old.employees[1] = { ...old.employees[1], firstName: 'Renamed' };
      localStorage.setItem('acme-people-db', JSON.stringify(old));

      const migrated = TestBed.runInInjectionContext(() => new DemoBackend());
      const employees = (migrated as unknown as { db: { employees: Employee[] } }).db.employees;
      expect(employees[0].location).toBe(seed.employees[0].location);
      expect(employees[2].managerId).toBe(seed.employees[2].managerId);
      expect(employees[0].department).toBe('Engineering');
      expect(employees[0].jobTitle).toBe('Head of Engineering');
      // Somebody the visitor changed is left exactly as they left it.
      expect(employees[1].firstName).toBe('Renamed');
      expect(employees[1].startDate).toBeUndefined();
    });
  });

  describe('org structure', () => {
    it('should give every seeded person a department and a job title', async () => {
      const employees = await request(http.get<Employee[]>('/employees'));
      for (const person of employees) {
        expect(['Engineering', 'Design', 'Quality', 'Delivery']).withContext(person.firstName).toContain(person.department!);
        expect(person.jobTitle).withContext(person.firstName).toBeTruthy();
      }
    });

    it('should add departments and job titles to people saved before they existed, keeping their other details', () => {
      const old = createDemoDatabase();
      old.employees = old.employees.map(({ department, jobTitle, ...rest }) => rest);
      old.employees[2] = { ...old.employees[2], location: 'Berlin', managerId: 1 };
      localStorage.setItem('acme-people-db', JSON.stringify(old));

      const migrated = TestBed.runInInjectionContext(() => new DemoBackend());
      const employees = (migrated as unknown as { db: { employees: Employee[] } }).db.employees;
      expect(employees[2].department).toBe('Design');
      expect(employees[2].jobTitle).toBe('Senior Product Designer');
      // What the visitor changed stays as they left it.
      expect(employees[2].location).toBe('Berlin');
      expect(employees[2].managerId).toBe(1);
    });
  });

  describe('leave balances', () => {
    // Fixed dates in a year the holiday calendar covers, so the sums don't move with today.
    const balancesOf = (employeeId: number, year = 2027) =>
      request(http.get<LeaveBalance[]>(`/leave-balances?employeeId=${employeeId}&year=${year}`));
    const balance = async (employeeId: number, type: LeaveBalance['type']) =>
      (await balancesOf(employeeId)).find((b) => b.type === type)!;
    const book = (employeeId: number, type: TimeOffRequest['type'], startDate: string, endDate: string) =>
      request(http.post<TimeOffRequest>('/time-off-requests', { employeeId, type, startDate, endDate }));
    const message = async (promise: Promise<unknown>) => {
      try {
        await promise;
        return 'allowed';
      } catch (error) {
        const { status, error: body } = error as HttpErrorResponse;
        return `${status} ${body?.message ?? ''}`.trim();
      }
    };

    it('should give a full allowance per tracked leave type', async () => {
      expect((await balancesOf(2)).map((b) => `${b.type} ${b.remaining}/${b.entitlement}`))
        .toEqual(['Vacation 25/25', 'Sick Leave 10/10', 'Other 3/3']);
    });

    it('should count working days only: weekends and the office\'s public holidays are free', async () => {
      // Fri 28 May – Tue 1 June 2027, with the London spring bank holiday on the Monday.
      await book(2, 'Vacation', '2027-05-28', '2027-06-01');
      expect(await balance(2, 'Vacation')).toEqual(jasmine.objectContaining({ pending: 2, taken: 0, remaining: 23 }));

      // The same dates in Lisbon, where that Monday is an ordinary working day.
      await book(8, 'Vacation', '2027-05-28', '2027-06-01');
      expect((await balance(8, 'Vacation')).pending).toBe(3);
    });

    it('should move days from pending to taken on approval, and give them back when declined', async () => {
      const first = await book(2, 'Vacation', '2027-06-07', '2027-06-08');
      const second = await book(2, 'Vacation', '2027-06-14', '2027-06-14');

      await request(http.patch(`/time-off-requests/${first.id}`, { status: 'Approved' }));
      expect(await balance(2, 'Vacation')).toEqual(jasmine.objectContaining({ taken: 2, pending: 1, remaining: 22 }));

      await request(http.patch(`/time-off-requests/${second.id}`, { status: 'Rejected' }));
      expect(await balance(2, 'Vacation')).toEqual(jasmine.objectContaining({ taken: 2, pending: 0, remaining: 23 }));
    });

    it('should refuse a booking for more days than are left', async () => {
      expect(await message(book(2, 'Other', '2027-06-07', '2027-06-10')))
        .toBe('422 This needs 4 days of personal leave in 2027, and only 3 of 3 are left.');

      await book(2, 'Other', '2027-06-07', '2027-06-08');
      expect(await message(book(2, 'Other', '2027-06-09', '2027-06-10')))
        .toBe('422 This needs 2 days of personal leave in 2027, and only 1 of 3 are left.');
      expect(await message(book(2, 'Other', '2027-06-09', '2027-06-09'))).toBe('allowed');
    });

    it('should refuse a booking that costs no leave or runs backwards', async () => {
      expect(await message(book(2, 'Vacation', '2027-06-12', '2027-06-13')))
        .toBe('422 Those dates are all weekends or public holidays, so no leave is needed.');
      expect(await message(book(2, 'Vacation', '2027-06-10', '2027-06-08')))
        .toBe("422 The last day can't be before the first day.");
      expect(await message(book(999, 'Vacation', '2027-06-08', '2027-06-08'))).toBe('400 Unknown employee');
    });

    it('should not limit leave types without an allowance', async () => {
      expect(await message(book(2, 'Maternity Leave', '2027-02-01', '2027-07-30'))).toBe('allowed');
    });

    it('should refuse to approve a request that has grown past the balance', async () => {
      const booked = await book(2, 'Other', '2027-06-07', '2027-06-09');
      await request(http.patch(`/time-off-requests/${booked.id}`, { endDate: '2027-06-11' }));

      const refusal = '422 This needs 5 days of personal leave in 2027, and only 3 of 3 are left.';
      expect(await message(request(http.patch(`/time-off-requests/${booked.id}`, { status: 'Approved' })))).toBe(refusal);
      expect(await message(request(http.put(`/time-off-requests/${booked.id}`, { ...booked, endDate: '2027-06-11', status: 'Approved' }))))
        .toBe(refusal);
      // Declining it is always possible.
      expect(await message(request(http.patch(`/time-off-requests/${booked.id}`, { status: 'Rejected' })))).toBe('allowed');
    });

    it('should refuse to grow approved leave past the balance', async () => {
      const booked = await book(2, 'Other', '2027-06-07', '2027-06-09');
      await request(http.patch(`/time-off-requests/${booked.id}`, { status: 'Approved' }));
      const approved = { ...booked, status: 'Approved' };

      const refusal = '422 This needs 5 days of personal leave in 2027, and only 3 of 3 are left.';
      expect(await message(request(http.patch(`/time-off-requests/${booked.id}`, { endDate: '2027-06-11' })))).toBe(refusal);
      expect(await message(request(http.put(`/time-off-requests/${booked.id}`, { ...approved, endDate: '2027-06-11' }))))
        .toBe(refusal);
      expect(await balance(2, 'Other')).toEqual(jasmine.objectContaining({ taken: 3, remaining: 0 }));

      // Moving it to another type is checked against that type's balance.
      expect(await message(request(http.patch(`/time-off-requests/${booked.id}`, { type: 'Vacation' })))).toBe('allowed');
      // Shrinking it, or changing nothing that costs leave, is fine.
      expect(await message(request(http.patch(`/time-off-requests/${booked.id}`, { type: 'Other', endDate: '2027-06-08' }))))
        .toBe('allowed');
      expect(await message(request(http.patch(`/time-off-requests/${booked.id}`, { status: 'Approved' })))).toBe('allowed');
      expect(await balance(2, 'Other')).toEqual(jasmine.objectContaining({ taken: 2, remaining: 1 }));
    });

    it('should reduce the allowance in the year somebody joins', async () => {
      // Charlotte joined 42 days ago, so her first year is a part of the full 25 days.
      const joined = seed.employees[14].startDate!;
      const [vacation] = await balancesOf(15, Number(joined.slice(0, 4)));
      expect(vacation.entitlement).toBeGreaterThan(0);
      expect(vacation.entitlement).toBeLessThan(25);
      expect((await balancesOf(15, Number(joined.slice(0, 4)) + 1))[0].entitlement).toBe(25);
    });

    it('should show people their own balances, and approvers those of the people they decide for', async () => {
      const people = async () => [...new Set((await request(http.get<LeaveBalance[]>('/leave-balances'))).map((b) => b.employeeId))];

      expect((await people()).length).toBe(seed.employees.length);

      await signIn('employee@acme.com');
      expect(await people()).toEqual([15]);
      expect((await balancesOf(15)).length).toBe(3);
      expect(await message(balancesOf(2)))
        .toBe('403 You can only see leave balances for yourself and the people who report to you.');

      await signIn('lead@acme.com');
      expect((await people()).sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 8, 11, 12, 15, 16, 17, 18]);
      expect(await message(balancesOf(18))).toBe('allowed');
      expect(await message(balancesOf(3))).toContain('403');

      // No People record and no approvals: nothing to show.
      await signIn('recruiter@acme.com');
      expect(await people()).toEqual([]);
    });

    it('should need a session and only answer reads', async () => {
      await expectError(request(http.post('/leave-balances', {})), 405);
      token = null;
      await expectError(request(http.get('/leave-balances')), 401);
    });

    it('should seed one-day absences on working days, so approving them costs a day', async () => {
      const requests = await request(http.get<TimeOffRequest[]>('/time-off-requests'));
      const moving = requests.find((r) => r.id === 5)!;
      expect(moving.startDate).toBe(nextWorkingDay(daysFromToday(12), 'Lisbon'));
      expect(await message(request(http.patch('/time-off-requests/5', { status: 'Approved' })))).toBe('allowed');
    });

    it('should let every seeded pending request be approved', async () => {
      const requests = await request(http.get<TimeOffRequest[]>('/time-off-requests'));
      for (const pending of requests.filter((r) => r.status === 'Pending')) {
        expect(await message(request(http.patch(`/time-off-requests/${pending.id}`, { status: 'Approved' }))))
          .withContext(`request ${pending.id}`).toBe('allowed');
      }
    });
  });

  describe('compensation', () => {
    const today = daysFromToday(0);
    const message = async (promise: Promise<unknown>) => {
      try {
        await promise;
        return 'allowed';
      } catch (error) {
        const { status, error: body } = error as HttpErrorResponse;
        return `${status} ${body?.message ?? ''}`.trim();
      }
    };
    const changes = (query = '') => request(http.get<SalaryChange[]>(`/salary-changes${query}`));
    const grants = (query = '') => request(http.get<StockGrant[]>(`/stock-grants${query}`));
    const ids = (rows: { employeeId: number }[]) => [...new Set(rows.map((r) => r.employeeId))].sort((a, b) => a - b);
    const proposal = (employeeId: number, baseSalary: number, extra: Record<string, unknown> = {}) => ({
      employeeId, baseSalary, currency: currencyFor(seed.employees.find((e) => e.id === employeeId)?.location),
      effectiveDate: daysFromToday(20), reason: 'Merit increase', ...extra,
    });
    const OUTSIDE_TEAM = '403 You can only do this for people who report to you.';

    describe('seed data', () => {
      it('should give everyone a salary today, in the currency of where they work', () => {
        for (const person of seed.employees) {
          const salary = currentSalary(seed['salary-changes'], person.id, today);
          expect(salary).withContext(person.firstName).toBeDefined();
          expect(salary!.currency).withContext(person.firstName).toBe(currencyFor(person.location));
          expect(seed['salary-changes'].find((c) => c.employeeId === person.id)!.reason).withContext(person.firstName).toBe('New hire');
        }
      });

      it('should have a band for every role and level in both currencies', () => {
        expect(seed['pay-bands'].length).toBe(32);
        expect(seed['pay-bands'].every((b) => b.max > b.min)).toBeTrue();
      });

      it('should grant options at the share price of the day, and never exercise more than vested', () => {
        for (const grant of seed['stock-grants']) {
          if (grant.kind === 'Stock options') {
            expect(grant.strikePrice).toBe(sharePriceOn(seed['share-prices'], grant.grantDate)?.pricePerShare ?? 0.85);
          }
          expect(grant.exercisedShares).toBeLessThanOrEqual(vestedShares(grant, today));
        }
      });

      it('should leave two raises waiting for HR and one declined', () => {
        expect(seed['salary-changes'].filter((c) => c.status === 'Pending').map((c) => c.employeeId)).toEqual([2, 5]);
        expect(seed['salary-changes'].filter((c) => c.status === 'Rejected').map((c) => c.employeeId)).toEqual([6]);
      });
    });

    describe('who sees whose pay', () => {
      it('should show HR everyone', async () => {
        expect(ids(await changes()).length).toBe(seed.employees.length);
        expect(ids(await grants()).length).toBe(new Set(seed['stock-grants'].map((g) => g.employeeId)).size);
      });

      it('should show a lead their reporting line, not themselves or another team', async () => {
        await signIn('lead@acme.com');
        // Olivia (1) leads 2, 4, 6, 8, 11, 12, 15, 16, 17, and 18 through Evelyn. Her own record is hers, so she sees it too.
        expect(ids(await changes())).toEqual([1, 2, 4, 6, 8, 11, 12, 15, 16, 17, 18]);
        expect(await changes('?employeeId=3')).toEqual([]);
      });

      it('should show an employee only their own', async () => {
        await signIn('employee@acme.com');
        expect(ids(await changes())).toEqual([15]);
        expect(ids(await grants())).toEqual([15]);
        expect(await changes('?employeeId=2')).toEqual([]);
        const liams = seed['salary-changes'].find((c) => c.employeeId === 2)!;
        expect(await message(request(http.get(`/salary-changes/${liams.id}`)))).toContain('404');
      });

      it('should show people with no People record and no pay rights nothing', async () => {
        await signIn('recruiter@acme.com');
        expect(await changes()).toEqual([]);
        expect(await grants()).toEqual([]);
      });

      it('should let everyone read the bands and the share price, and only HR change them', async () => {
        await signIn('employee@acme.com');
        expect((await request(http.get<PayBand[]>('/pay-bands'))).length).toBe(32);
        expect((await request(http.get<SharePrice[]>('/share-prices'))).length).toBe(5);
        expect(await message(request(http.patch('/pay-bands/1', { max: 999_999 })))).toBe("403 Your role can't change pay or equity.");
        await signIn('lead@acme.com');
        expect(await message(request(http.post('/share-prices', { pricePerShare: 99, effectiveDate: today })))).toBe("403 Your role can't change pay or equity.");
      });
    });

    describe('changing salaries', () => {
      it("should record HR's change at once, as decided by them", async () => {
        const saved = await request(http.post<SalaryChange>('/salary-changes', proposal(3, 80_000, { reason: 'Promotion' })));
        expect(saved).toEqual(jasmine.objectContaining({
          status: 'Approved', proposedBy: 'Alex Morgan', decidedBy: 'Alex Morgan', decidedAt: today,
        }));
      });

      it("should hold a lead's proposal for HR, whatever status it asks for", async () => {
        await signIn('lead@acme.com');
        const proposed = await request(http.post<SalaryChange>('/salary-changes', proposal(18, 60_000, { status: 'Approved', decidedBy: 'Me' })));
        expect(proposed.status).toBe('Pending');
        expect(proposed.proposedBy).toBe('Olivia Bennett');
        expect(proposed.decidedBy).toBeUndefined();

        // HR approves it: who proposed it stays, who decided it is recorded.
        await signIn('admin@acme.com');
        const approved = await request(http.patch<SalaryChange>(`/salary-changes/${proposed.id}`, { status: 'Approved', proposedBy: 'Someone else' }));
        expect(approved).toEqual(jasmine.objectContaining({ status: 'Approved', proposedBy: 'Olivia Bennett', decidedBy: 'Alex Morgan' }));
      });

      it('should not let a lead propose for themselves or another team, or decide anything', async () => {
        await signIn('lead@acme.com');
        expect(await message(request(http.post('/salary-changes', proposal(1, 200_000))))).toBe(OUTSIDE_TEAM);
        expect(await message(request(http.post('/salary-changes', proposal(3, 90_000))))).toBe(OUTSIDE_TEAM);
        const liams = seed['salary-changes'].find((c) => c.employeeId === 2 && c.status === 'Pending')!;
        expect(await message(request(http.patch(`/salary-changes/${liams.id}`, { status: 'Approved' }))))
          .toBe("403 Your role can't change pay or equity.");
      });

      it('should let a lead withdraw a waiting proposal, but not remove a decided change', async () => {
        await signIn('lead@acme.com');
        const liams = seed['salary-changes'].filter((c) => c.employeeId === 2);
        const approved = liams.find((c) => c.status === 'Approved')!;
        const pending = liams.find((c) => c.status === 'Pending')!;
        expect(await message(request(http.delete(`/salary-changes/${approved.id}`)))).toBe("403 Your role can't change pay or equity.");
        expect(await message(request(http.delete(`/salary-changes/${pending.id}`)))).toBe('allowed');
      });

      it('should not let an employee propose their own raise', async () => {
        await signIn('employee@acme.com');
        expect(await message(request(http.post('/salary-changes', proposal(15, 90_000)))))
          .toBe("403 Your role can't see or propose other people's pay.");
      });

      it('should refuse a change that makes no sense', async () => {
        expect(await message(request(http.post('/salary-changes', proposal(2, -5))))).toBe('422 Enter a salary above zero.');
        expect(await message(request(http.post('/salary-changes', proposal(2, 90_000, { currency: 'JPY' })))))
          .toBe('422 Pay is in pounds (GBP) or euros (EUR).');
        expect(await message(request(http.post('/salary-changes', proposal(2, 90_000, { effectiveDate: '2026-13-01' })))))
          .toBe('422 Pick the day the new salary starts.');
        expect(await message(request(http.post('/salary-changes', proposal(999, 90_000))))).toBe('400 Unknown employee');
        const any = seed['salary-changes'][0];
        expect(await message(request(http.patch(`/salary-changes/${any.id}`, { status: 'Maybe' })))).toBe('400 Unknown status');
      });
    });

    describe('equity', () => {
      const grant = (extra: Record<string, unknown> = {}) => ({
        employeeId: 18, kind: 'Stock options', shares: 4_000, strikePrice: 9.4, grantDate: today, vestingStart: today,
        vestingMonths: 48, cliffMonths: 12, expirationDate: daysFromToday(3650), ...extra,
      });

      it('should let HR grant options, starting with none exercised', async () => {
        const saved = await request(http.post<StockGrant>('/stock-grants', grant()));
        expect(saved.exercisedShares).toBe(0);
      });

      it('should not let anyone but HR grant equity', async () => {
        await signIn('lead@acme.com');
        expect(await message(request(http.post('/stock-grants', grant())))).toBe("403 Your role can't change pay or equity.");
      });

      it('should record an exercise only up to what has vested', async () => {
        // Harper joined seven months ago: nothing has vested before the one-year cliff.
        const harpers = seed['stock-grants'].find((g) => g.employeeId === 13)!;
        expect(await message(request(http.patch(`/stock-grants/${harpers.id}`, { exercisedShares: 1 }))))
          .toBe('422 Only 0 of these options have vested, so no more can be exercised.');
        const liams = seed['stock-grants'].find((g) => g.employeeId === 2)!;
        expect(vestedShares(liams, today)).toBe(liams.shares);
        expect(await message(request(http.patch(`/stock-grants/${liams.id}`, { exercisedShares: 2_000 })))).toBe('allowed');
        expect(await message(request(http.patch(`/stock-grants/${liams.id}`, { exercisedShares: liams.shares + 1 }))))
          .toBe('422 Exercised shares have to be a whole number, no more than the grant.');
      });

      it('should refuse grants that make no sense', async () => {
        expect(await message(request(http.post('/stock-grants', grant({ cliffMonths: 60 }))))).toBe("422 The cliff can't be longer than vesting.");
        expect(await message(request(http.post('/stock-grants', grant({ kind: 'RSUs' })))))
          .toBe("422 RSUs don't have a strike price or an expiry date.");
        expect(await message(request(http.post('/stock-grants', grant({ employeeId: 999 }))))).toBe('400 Unknown employee');
      });
    });

    describe('bands and share prices', () => {
      it('should refuse a second band for the same role, level and currency', async () => {
        expect(await message(request(http.post('/pay-bands', { position: 'QA', level: 'Junior', currency: 'GBP', min: 1, max: 2 }))))
          .toBe('409 There is already a GBP band for Junior QA.');
        expect(await message(request(http.patch('/pay-bands/1', { min: 60_000, max: 50_000 }))))
          .toBe('422 The top of the band has to be above the bottom.');
        expect(await message(request(http.patch('/pay-bands/1', { min: 40_000, max: 55_000 })))).toBe('allowed');
      });

      it('should add a valuation', async () => {
        expect(await message(request(http.post('/share-prices', { pricePerShare: 11.25, effectiveDate: today, note: 'Series C' })))).toBe('allowed');
        expect(await message(request(http.post('/share-prices', { pricePerShare: 0, effectiveDate: today }))))
          .toBe('422 Enter a price per share above zero.');
      });
    });

    it("should remove someone's pay and equity with them", async () => {
      await request(http.delete('/employees/2'));
      expect(await changes('?employeeId=2')).toEqual([]);
      expect(await grants('?employeeId=2')).toEqual([]);
    });

    it('should add pay to demo data saved before it existed, for the people still there', () => {
      const old = createDemoDatabase() as unknown as Record<string, unknown> & { employees: Employee[] };
      for (const key of ['pay-bands', 'salary-changes', 'stock-grants', 'share-prices']) delete old[key];
      old.employees = old.employees.filter((e) => e.id !== 2);
      localStorage.setItem('acme-people-db', JSON.stringify(old));

      const migrated = TestBed.runInInjectionContext(() => new DemoBackend());
      const db = (migrated as unknown as { db: typeof seed }).db;
      expect(db['pay-bands'].length).toBe(32);
      expect(db['share-prices'].length).toBe(5);
      expect(db['salary-changes'].some((c) => c.employeeId === 2)).toBeFalse();
      expect(db['salary-changes'].some((c) => c.employeeId === 3)).toBeTrue();
      expect(db['stock-grants'].some((g) => g.employeeId === 2)).toBeFalse();
    });
  });
});
