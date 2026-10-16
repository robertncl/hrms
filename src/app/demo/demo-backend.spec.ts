import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { DemoBackend, demoBackendInterceptor } from './demo-backend';
import { DEMO_PASSWORD, createDemoDatabase, daysFromToday, workEmail } from './demo-data';
import { Employee } from '../infrastructure/types/employee';
import { Project } from '../infrastructure/types/project';
import { Candidate } from '../infrastructure/types/candidate';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';

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
});
