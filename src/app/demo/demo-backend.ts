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
import { TIME_OFF_STATUSES, TIME_OFF_TYPES, TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { inScope, scopeOf } from '../shared/functions/org';
import { dateRangeProblem, leaveBalances, leaveProblem, workingDays } from '../shared/functions/leave';
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
    OrgWideAccess: 'act outside your own team',
};
const forbidden = (permission: Permissions): Result => fail(403, `Your role can't ${ACTIONS[permission]}.`);
const outsideTeam = (): Result => fail(403, 'You can only do this for people who report to you.');

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
        } else if (first === 'leave-balances' && !second) {
            result = this.balances(req, url.searchParams);
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
        // A permission says what you may do; scope says for whom. Without
        // OrgWideAccess that is your own reporting line, never yourself.
        const scope = this.scope(account);
        const within = (employeeId: unknown) => scope === null || (typeof employeeId === 'number' && scope.has(employeeId));
        // New rows name their person in the body; existing ones already have one.
        const subject = method === 'POST' ? body['employeeId'] : row?.['employeeId'];
        // Handing an existing row to somebody else needs that person in scope too.
        const moved = method !== 'POST' && 'employeeId' in body && body['employeeId'] !== subject;
        const covered = () => (within(subject) && (!moved || within(body['employeeId'])) ? null : outsideTeam());

        switch (collection) {
            case 'employees': {
                if (method === 'GET') return need('ViewEmployees');
                if (method === 'POST') return need('CreateEmployee');
                if (method === 'DELETE') return need('DeleteEmployee');
                const changesPrivate = PRIVATE_EMPLOYEE_FIELDS.some(field => field in body && body[field] !== row?.[field]);
                return need('EditEmployeeGeneralDetails')
                    ?? (within(row?.id) ? null : outsideTeam())
                    ?? (changesPrivate ? need('EditEmployeePrivateDetails') : null);
            }
            case 'time-off-requests':
                if (method === 'GET') return null;
                // Everyone manages their own requests: they book them, and
                // withdraw them while they are still pending.
                if (method === 'POST' && own(body['employeeId'])) return null;
                if (method === 'DELETE' && row && own(row['employeeId']) && row['status'] === 'Pending') return null;
                return need('ApproveTimeOff') ?? covered();
            case 'candidates':
                return need('ManageHiring');
            case 'courses':
                return method === 'GET' ? null : need('ManageCourses');
            case 'enrollments': {
                if (method === 'GET') return null;
                // Learners can record their own progress, and nothing else.
                const onlyProgress = Object.keys(body).every(key => key === 'completedModules');
                if ((method === 'PATCH') && row && own(row['employeeId']) && onlyProgress) return null;
                return need('AssignTraining') ?? covered();
            }
            case 'projects':
                return null;
        }
    }

    private scope(account: DemoAccount): Set<number> | null {
        return scopeOf(this.db.employees, {
            orgWide: permissionsFor(account.role).OrgWideAccess,
            employeeId: account.employeeId,
        });
    }

    /**
     * GET /leave-balances?employeeId=&year= — what each person has left to
     * book. People see their own; approvers also see the people in their scope.
     */
    private balances(req: HttpRequest<unknown>, query: URLSearchParams): Result {
        const account = this.signedIn(req);
        if (!account) {
            return fail(401, 'Your session has ended. Sign in again.');
        }
        if (req.method !== 'GET') {
            return fail(405, 'Method not allowed');
        }
        const scope = permissionsFor(account.role).ApproveTimeOff ? this.scope(account) : new Set<number>();
        const visible = (id: number) => id === account.employeeId || inScope(scope, id);
        const year = Number(query.get('year')) || new Date().getFullYear();
        const requested = query.get('employeeId');

        if (requested !== null && !visible(Number(requested))) {
            return fail(403, 'You can only see leave balances for yourself and the people who report to you.');
        }
        const people = this.db.employees.filter(e => (requested === null ? visible(e.id) : e.id === Number(requested)));
        return ok(people.flatMap(person => leaveBalances(person, this.db['time-off-requests'], year)));
    }

    /**
     * Leave has to fit the person's balance, both when it is booked and when
     * it is approved. A request that costs no working days can't be booked,
     * but one already on file can still be approved: it uses nothing.
     */
    private leaveRefusal(
        request: Pick<TimeOffRequest, 'employeeId' | 'type' | 'startDate' | 'endDate'> & { id?: number },
        approving = false,
    ): Result | null {
        const person = this.db.employees.find(e => e.id === request.employeeId);
        if (!person) {
            return fail(400, 'Unknown employee');
        }
        if (!TIME_OFF_TYPES.includes(request.type)) {
            return fail(400, 'Unknown type of leave');
        }
        const range = dateRangeProblem(request.startDate, request.endDate);
        if (range) {
            return fail(422, range);
        }
        if (approving && workingDays(request.startDate, request.endDate, person.location) === 0) {
            return null;
        }
        const problem = leaveProblem(person, this.db['time-off-requests'], request);
        return problem ? fail(422, problem) : null;
    }

    /**
     * Any change to a request is checked like a booking: approving it, and
     * also moving its dates, type or person after it was booked or approved,
     * so approved leave can't be stretched past the balance afterwards.
     */
    private timeOffChangeRefusal(before: TimeOffRequest, after: TimeOffRequest): Result | null {
        if (!TIME_OFF_STATUSES.includes(after.status)) {
            return fail(400, 'Unknown status');
        }
        const moved = (['employeeId', 'type', 'startDate', 'endDate'] as const).some(key => before[key] !== after[key]);
        const approving = after.status === 'Approved' && before.status !== 'Approved';
        if (!moved && !approving) {
            return null;
        }
        if (after.status === 'Rejected') {
            // Declined leave costs nothing, but its dates still have to make sense.
            const range = dateRangeProblem(after.startDate, after.endDate);
            return range ? fail(422, range) : null;
        }
        return this.leaveRefusal(after, approving && !moved);
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
                        // Booking and deciding are separate steps: nobody books leave already approved.
                        ...(collection === 'time-off-requests' ? { status: 'Pending' } : {}),
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
            case 'PUT': {
                const next = (req.method === 'PATCH'
                    ? { ...rows[index], ...body, id: rows[index].id }
                    : { ...body, id: rows[index].id }) as Row;
                const refused = collection === 'time-off-requests'
                    ? this.timeOffChangeRefusal(rows[index] as unknown as TimeOffRequest, next as unknown as TimeOffRequest)
                    : null;
                if (refused) {
                    return refused;
                }
                rows[index] = this.normalize(collection, next);
                return ok(this.view(collection, rows[index]));
            }
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
        if (collection === 'time-off-requests') {
            return this.leaveRefusal(body as unknown as TimeOffRequest);
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
    // Seeded people saved before a detail existed get it filled in. Whatever
    // the visitor set themselves (including a cleared manager) is left alone.
    const seeded = new Map(seed.employees.map(e => [e.id, e]));
    const ids = new Set(db.employees.map(e => e.id));
    db.employees = db.employees.map(e => {
        const fresh = seeded.get(e.id);
        if (!fresh || fresh.firstName !== e.firstName || fresh.lastName !== e.lastName) {
            return e;
        }
        const { department, jobTitle, startDate, location, managerId, phone, personalEmail } = fresh;
        const hadDetails = e.startDate !== undefined;
        return {
            department,
            jobTitle,
            startDate,
            location,
            ...(!hadDetails && managerId && ids.has(managerId) ? { managerId } : {}),
            phone,
            personalEmail,
            ...e,
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
