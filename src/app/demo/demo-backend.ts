import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest,
    HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import { Employee, PRIVATE_EMPLOYEE_FIELDS } from '../infrastructure/types/employee';
import { Enrollment } from '../infrastructure/types/course';
import { Permissions } from '../infrastructure/types/permissions';
import {
    DEMO_ACCOUNTS,
    DEMO_DOMAIN,
    DemoAccount,
    DemoDatabase,
    LEGACY_DEMO_DOMAIN,
    StoredEnrollment,
    createDemoDatabase,
    daysFromToday,
    permissionsFor,
} from './demo-data';

const STORAGE_KEY = 'acme-people-db';

type Collection = Exclude<keyof DemoDatabase, 'users'>;
type Row = { id: number } & Record<string, unknown>;
type Result = { status: number; body: unknown };

const COLLECTIONS: Collection[] = ['employees', 'projects', 'candidates', 'time-off-requests', 'courses', 'enrollments'];

/** New hires get every mandatory course, due this many days after they start. */
const MANDATORY_COURSE_DUE_DAYS = 30;

const ok = (body: unknown, status = 200): Result => ({ status, body });
const fail = (status: number, message: string): Result => ({ status, body: { message } });

/** How a refusal reads: "Your role can't approve time off." */
const ACTIONS: Record<Permissions, string> = {
    ViewEmployees: 'see People',
    CreateEmployee: 'add people',
    EditEmployeeGeneralDetails: 'edit people',
    EditEmployeePrivateDetails: 'change private details',
    DeleteEmployee: 'remove people',
    ApproveTimeOff: 'approve time off',
    ManageHiring: 'work on hiring',
    AssignTraining: 'assign training',
    ManageCourses: 'change the course catalog',
};
const forbidden = (permission: Permissions): Result => fail(403, `Your role can't ${ACTIONS[permission]}.`);

/** Tokens name the account they were issued to: `demo.<base64 email>.<random>`. */
const issueToken = (email: string) => `demo.${btoa(encodeURIComponent(email))}.${randomId()}`;

function tokenEmail(req: HttpRequest<unknown>): string | null {
    const match = /^Bearer demo\.([A-Za-z0-9+/=]+)\.[\w-]+$/.exec(req.headers.get('Authorization') ?? '');
    if (!match) {
        return null;
    }
    try {
        return decodeURIComponent(atob(match[1]));
    } catch {
        return null;
    }
}

/** What the client is told about whoever is signed in. */
function session(account: DemoAccount) {
    const { password: _, ...user } = account;
    return { user, permissions: permissionsFor(account.role) };
}

/**
 * In-browser stand-in for the ACME People REST API, so the demo runs without a server.
 *
 * It mimics the json-server conventions the services already use
 * (`/employees`, `/employees/:id`, `?firstName_like=`) plus `/api/auth/*`,
 * and persists every change to localStorage until `reset()` is called.
 */
@Injectable({ providedIn: 'root' })
export class DemoBackend {
    /** Simulated network latency, so loading states are visible. */
    latency = 250;
    private db = this.load();

    /** Returns a response for API requests, or null to let the request through. */
    handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> | null {
        const url = new URL(req.urlWithParams, 'http://demo.invalid');
        const [first, second, third, ...rest] = url.pathname.split('/').filter(Boolean);

        let result: Result;
        if (first === 'api' && second === 'auth' && third && rest.length === 0) {
            result = this.auth(third, req);
        } else if (COLLECTIONS.includes(first as Collection) && !third) {
            result = this.rest(first as Collection, second, req, url.searchParams);
        } else {
            return null;
        }
        this.save();

        return timer(this.latency).pipe(
            mergeMap(() =>
                result.status < 400
                    ? of(new HttpResponse({ status: result.status, body: result.body, url: req.url }))
                    : throwError(() => new HttpErrorResponse({
                        status: result.status,
                        error: result.body,
                        url: req.url,
                    })),
            ),
        );
    }

    /** Restores the original seed data. */
    reset() {
        this.db = createDemoDatabase();
        this.save();
    }

    private auth(action: string, req: HttpRequest<unknown>): Result {
        if (action === 'session') {
            if (req.method !== 'GET') {
                return fail(405, 'Method not allowed');
            }
            const account = this.signedIn(req);
            return account ? ok(session(account)) : fail(401, 'Your session has ended. Sign in again.');
        }
        if (req.method !== 'POST') {
            return fail(405, 'Method not allowed');
        }
        const { email = '', password = '' } = (req.body ?? {}) as { email?: string; password?: string };
        const normalizedEmail = email.trim().toLowerCase();

        switch (action) {
            case 'login': {
                const account = this.account(normalizedEmail);
                if (account && account.password === password) {
                    return ok({ token: issueToken(account.email), ...session(account) });
                }
                if (!account && normalizedEmail.endsWith(`@${LEGACY_DEMO_DOMAIN}`)) {
                    const [name] = normalizedEmail.split('@');
                    const suggestion = DEMO_ACCOUNTS.find(a => a.email === `${name}@${DEMO_DOMAIN}`)?.email ?? DEMO_ACCOUNTS[0].email;
                    return fail(401, `The demo accounts moved to @${DEMO_DOMAIN}. Try ${suggestion} with the password ${DEMO_ACCOUNTS[0].password}.`);
                }
                return fail(401, 'Invalid email or password');
            }
            case 'logout':
                return ok({});
            case 'register': {
                if (!normalizedEmail || !password) {
                    return fail(400, 'Email and password are required');
                }
                if (this.account(normalizedEmail)) {
                    return fail(409, 'An account with this email already exists');
                }
                // Self-registered accounts can try everything.
                this.db.users.push({
                    name: normalizedEmail.split('@')[0],
                    email: normalizedEmail,
                    role: 'HR Administrator',
                    password,
                });
                return ok({}, 201);
            }
            default:
                return fail(404, 'Not found');
        }
    }

    /** A built-in demo account (always current, from code) or a registered one. */
    private account(email: string): DemoAccount | undefined {
        const normalized = email.trim().toLowerCase();
        return DEMO_ACCOUNTS.find(a => a.email === normalized)
            ?? this.db.users.find(u => u.email.toLowerCase() === normalized);
    }

    private signedIn(req: HttpRequest<unknown>): DemoAccount | undefined {
        const email = tokenEmail(req);
        return email ? this.account(email) : undefined;
    }

    /**
     * The API's half of the permission model: the UI hides what a role can't
     * do, and this refuses it anyway, so the two can't drift apart unnoticed.
     */
    private authorize(account: DemoAccount, collection: Collection, method: string, row: Row | undefined, body: Record<string, unknown>): Result | null {
        const permissions = permissionsFor(account.role);
        const need = (permission: Permissions) => (permissions[permission] ? null : forbidden(permission));
        const own = (employeeId: unknown) => account.employeeId !== undefined && employeeId === account.employeeId;

        switch (collection) {
            case 'employees': {
                if (method === 'GET') return need('ViewEmployees');
                if (method === 'POST') return need('CreateEmployee');
                if (method === 'DELETE') return need('DeleteEmployee');
                const changesPrivate = PRIVATE_EMPLOYEE_FIELDS.some(field => field in body && body[field] !== row?.[field]);
                return need('EditEmployeeGeneralDetails') ?? (changesPrivate ? need('EditEmployeePrivateDetails') : null);
            }
            case 'time-off-requests':
                if (method === 'GET' || permissions.ApproveTimeOff) return null;
                // Without approval rights people manage only their own requests:
                // book them, and withdraw them while they are still pending.
                if (method === 'POST' && own(body['employeeId'])) return null;
                if (method === 'DELETE' && row && own(row['employeeId']) && row['status'] === 'Pending') return null;
                return forbidden('ApproveTimeOff');
            case 'candidates':
                return need('ManageHiring');
            case 'courses':
                return method === 'GET' ? null : need('ManageCourses');
            case 'enrollments': {
                if (method === 'GET' || permissions.AssignTraining) return null;
                // Learners can record their own progress, and nothing else.
                const onlyProgress = Object.keys(body).every(key => key === 'completedModules');
                if ((method === 'PATCH') && row && own(row['employeeId']) && onlyProgress) return null;
                return forbidden('AssignTraining');
            }
            case 'projects':
                return null;
        }
    }

    private rest(collection: Collection, idSegment: string | undefined, req: HttpRequest<unknown>, query: URLSearchParams): Result {
        const rows = this.db[collection] as unknown as Row[];
        const id = idSegment === undefined ? undefined : Number(idSegment);
        const index = id === undefined ? -1 : rows.findIndex(row => row.id === id);
        const body = (req.body ?? {}) as Record<string, unknown>;

        const account = this.signedIn(req);
        if (!account) {
            return fail(401, 'Your session has ended. Sign in again.');
        }
        const refusal = this.authorize(account, collection, req.method, index === -1 ? undefined : rows[index], body);
        if (refusal) {
            return refusal;
        }

        if (id === undefined) {
            switch (req.method) {
                case 'GET':
                    return ok(rows.filter(row => matches(row, query)).map(row => this.view(collection, row)));
                case 'POST': {
                    const rejection = this.validateCreate(collection, body);
                    if (rejection) {
                        return rejection;
                    }
                    const created = {
                        ...defaultsFor(collection),
                        ...body,
                        id: nextId(rows),
                    } as Row;
                    rows.push(this.normalize(collection, created));
                    if (collection === 'employees') {
                        this.enrollInMandatoryCourses(created.id);
                    }
                    return ok(this.view(collection, rows[rows.length - 1]), 201);
                }
                default:
                    return fail(405, 'Method not allowed');
            }
        }

        if (index === -1) {
            return fail(404, `No ${collection} record with id ${idSegment}`);
        }

        switch (req.method) {
            case 'GET':
                return ok(this.view(collection, rows[index]));
            case 'PATCH':
                rows[index] = this.normalize(collection, { ...rows[index], ...body, id: rows[index].id });
                return ok(this.view(collection, rows[index]));
            case 'PUT':
                rows[index] = this.normalize(collection, { ...body, id: rows[index].id } as Row);
                return ok(this.view(collection, rows[index]));
            case 'DELETE':
                rows.splice(index, 1);
                if (collection === 'employees') {
                    this.removeEmployeeReferences(id!);
                }
                if (collection === 'courses') {
                    this.db.enrollments = this.db.enrollments.filter(e => e.courseId !== id);
                }
                return ok({});
            default:
                return fail(405, 'Method not allowed');
        }
    }

    /** Returns a copy of the row, with derived fields filled in. */
    private view(collection: Collection, row: Row): unknown {
        const copy = structuredClone(row);
        if (collection === 'employees') {
            // Availability follows approved time off, so approving a request
            // that covers today immediately marks the employee as away.
            const today = daysFromToday(0);
            (copy as unknown as Employee).isAvailable = !this.db['time-off-requests'].some(
                r => r.employeeId === row.id && r.status === 'Approved' && r.startDate <= today && today <= r.endDate,
            );
        }
        if (collection === 'enrollments') {
            const enrollment = copy as unknown as Enrollment;
            const total = this.moduleCount(enrollment.courseId);
            enrollment.progress = total ? Math.round((enrollment.completedModules / total) * 100) : 0;
            enrollment.status = enrollment.completedModules === 0
                ? 'Not started'
                : enrollment.completedModules >= total ? 'Completed' : 'In progress';
        }
        return copy;
    }

    private validateCreate(collection: Collection, body: Record<string, unknown>): Result | null {
        if (collection === 'enrollments') {
            if (!this.db.courses.some(c => c.id === body['courseId'])) {
                return fail(400, 'Unknown course');
            }
            if (this.db.enrollments.some(e => e.courseId === body['courseId'] && e.employeeId === body['employeeId'])) {
                return fail(409, 'This employee is already enrolled in the course');
            }
        }
        return null;
    }

    /** Keeps stored rows consistent: enrollment progress stays in range and completion is dated. */
    private normalize(collection: Collection, row: Row): Row {
        if (collection !== 'enrollments') {
            return row;
        }
        const enrollment = row as unknown as StoredEnrollment & Row;
        const total = this.moduleCount(enrollment.courseId);
        enrollment.completedModules = Math.min(Math.max(Math.round(Number(enrollment.completedModules) || 0), 0), total);
        // Derived fields are never stored.
        delete (enrollment as Partial<Enrollment>).status;
        delete (enrollment as Partial<Enrollment>).progress;
        if (enrollment.completedModules >= total) {
            enrollment.completedAt ??= daysFromToday(0);
        } else {
            delete enrollment.completedAt;
        }
        return enrollment;
    }

    private moduleCount(courseId: number): number {
        return this.db.courses.find(c => c.id === courseId)?.modules.length ?? 0;
    }

    private enrollInMandatoryCourses(employeeId: number) {
        for (const course of this.db.courses.filter(c => c.mandatory)) {
            this.db.enrollments.push({
                id: nextId(this.db.enrollments),
                courseId: course.id,
                employeeId,
                assignedAt: daysFromToday(0),
                dueDate: daysFromToday(MANDATORY_COURSE_DUE_DAYS),
                completedModules: 0,
            });
        }
    }

    private removeEmployeeReferences(employeeId: number) {
        this.db.enrollments = this.db.enrollments.filter(e => e.employeeId !== employeeId);
        this.db['time-off-requests'] = this.db['time-off-requests'].filter(r => r.employeeId !== employeeId);
        for (const project of this.db.projects) {
            project.employees = project.employees.filter(id => id !== employeeId);
        }
    }

    private load(): DemoDatabase {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<DemoDatabase> | null;
            if (stored && ['employees', 'projects', 'candidates', 'time-off-requests', 'users'].every(key => Array.isArray(stored[key as keyof DemoDatabase]))) {
                return migrate(stored);
            }
        } catch {
            // Unreadable or blocked storage: fall back to fresh seed data.
        }
        return createDemoDatabase();
    }

    private save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
        } catch {
            // Storage may be full or blocked; the demo keeps working in memory.
        }
    }
}

/** json-server style filtering: `field=value` matches exactly, `field_like=value` matches a substring or array member. */
function matches(row: Row, query: URLSearchParams): boolean {
    for (const [key, value] of query) {
        const isLike = key.endsWith('_like');
        const field = row[isLike ? key.slice(0, -'_like'.length) : key];
        if (Array.isArray(field)) {
            if (!field.map(String).includes(value)) {
                return false;
            }
        } else if (isLike) {
            if (!String(field ?? '').toLowerCase().includes(value.toLowerCase())) {
                return false;
            }
        } else if (String(field) !== value) {
            return false;
        }
    }
    return true;
}

/** Brings data saved by an older version up to date, keeping the visitor's changes. */
function migrate(stored: Partial<DemoDatabase>): DemoDatabase {
    const seed = createDemoDatabase();
    const db = { ...seed, ...stored } as DemoDatabase;
    if (!Array.isArray(stored.courses) || !Array.isArray(stored.enrollments)) {
        const employeeIds = new Set(db.employees.map(e => e.id));
        db.courses = seed.courses;
        db.enrollments = seed.enrollments.filter(e => employeeIds.has(e.employeeId));
    }
    // Built-in accounts now live in code, so stale saved copies (with old
    // emails or permissions) can no longer shadow them.
    const builtIn = new Set(DEMO_ACCOUNTS.map(a => a.email));
    db.users = db.users
        .filter(u => !builtIn.has(u.email.toLowerCase()) && !u.email.toLowerCase().endsWith(`@${LEGACY_DEMO_DOMAIN}`))
        .map(({ name, email, password, role }) => ({ name, email, password, role: role ?? 'HR Administrator' }));
    // Seeded people saved before employee details existed get them filled in.
    const seeded = new Map(seed.employees.map(e => [e.id, e]));
    const ids = new Set(db.employees.map(e => e.id));
    db.employees = db.employees.map(e => {
        const fresh = seeded.get(e.id);
        if (!fresh || e.startDate || fresh.firstName !== e.firstName || fresh.lastName !== e.lastName) {
            return e;
        }
        const { startDate, location, managerId, phone, personalEmail } = fresh;
        return {
            ...e,
            startDate,
            location,
            ...(managerId && ids.has(managerId) ? { managerId } : {}),
            phone,
            personalEmail,
        };
    });
    return db;
}

function nextId(rows: { id: number }[]): number {
    return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

function defaultsFor(collection: Collection): Record<string, unknown> {
    switch (collection) {
        case 'employees':
            return { isAvailable: true, profilePicture: '' };
        case 'candidates':
            return { status: 'CV evaluation', offerAccepted: false, appliedAt: daysFromToday(0) };
        case 'time-off-requests':
            return { status: 'Pending' };
        case 'projects':
            return { employees: [], subProjectIds: [], image: '' };
        case 'courses':
            return { mandatory: false, modules: [], description: '' };
        case 'enrollments':
            return { completedModules: 0, assignedAt: daysFromToday(0) };
    }
}

function randomId(): string {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export const demoBackendInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
) => inject(DemoBackend).handle(req) ?? next(req);
