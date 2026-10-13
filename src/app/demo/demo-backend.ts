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
import { Employee } from '../infrastructure/types/employee';
import { DemoDatabase, createDemoDatabase, daysFromToday } from './demo-data';

const STORAGE_KEY = 'hrms-demo-db';

type Collection = Exclude<keyof DemoDatabase, 'users'>;
type Row = { id: number } & Record<string, unknown>;
type Result = { status: number; body: unknown };

const COLLECTIONS: Collection[] = ['employees', 'projects', 'candidates', 'time-off-requests'];

const ok = (body: unknown, status = 200): Result => ({ status, body });
const fail = (status: number, message: string): Result => ({ status, body: { message } });

/**
 * In-browser stand-in for the HRMS REST API, so the demo runs without a server.
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
        if (req.method !== 'POST') {
            return fail(405, 'Method not allowed');
        }
        const { email = '', password = '' } = (req.body ?? {}) as { email?: string; password?: string };
        const normalizedEmail = email.trim().toLowerCase();

        switch (action) {
            case 'login': {
                const account = this.db.users.find(
                    u => u.email.toLowerCase() === normalizedEmail && u.password === password,
                );
                if (!account) {
                    return fail(401, 'Invalid email or password');
                }
                const { password: _, permissions, ...user } = account;
                return ok({ token: `demo-${randomId()}`, user, permissions });
            }
            case 'logout':
                return ok({});
            case 'register': {
                if (!normalizedEmail || !password) {
                    return fail(400, 'Email and password are required');
                }
                if (this.db.users.some(u => u.email.toLowerCase() === normalizedEmail)) {
                    return fail(409, 'An account with this email already exists');
                }
                this.db.users.push({
                    name: normalizedEmail.split('@')[0],
                    email: normalizedEmail,
                    role: 'HR Administrator',
                    password,
                    permissions: { ...this.db.users[0].permissions },
                });
                return ok({}, 201);
            }
            default:
                return fail(404, 'Not found');
        }
    }

    private rest(collection: Collection, idSegment: string | undefined, req: HttpRequest<unknown>, query: URLSearchParams): Result {
        const rows = this.db[collection] as unknown as Row[];
        const id = idSegment === undefined ? undefined : Number(idSegment);
        const index = id === undefined ? -1 : rows.findIndex(row => row.id === id);
        const body = (req.body ?? {}) as Record<string, unknown>;

        if (id === undefined) {
            switch (req.method) {
                case 'GET':
                    return ok(rows.filter(row => matches(row, query)).map(row => this.view(collection, row)));
                case 'POST': {
                    const created = {
                        ...defaultsFor(collection),
                        ...body,
                        id: rows.reduce((max, row) => Math.max(max, row.id), 0) + 1,
                    } as Row;
                    rows.push(created);
                    return ok(this.view(collection, created), 201);
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
                rows[index] = { ...rows[index], ...body, id: rows[index].id };
                return ok(this.view(collection, rows[index]));
            case 'PUT':
                rows[index] = { ...body, id: rows[index].id } as Row;
                return ok(this.view(collection, rows[index]));
            case 'DELETE':
                rows.splice(index, 1);
                if (collection === 'employees') {
                    this.removeEmployeeReferences(id!);
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
        return copy;
    }

    private removeEmployeeReferences(employeeId: number) {
        this.db['time-off-requests'] = this.db['time-off-requests'].filter(r => r.employeeId !== employeeId);
        for (const project of this.db.projects) {
            project.employees = project.employees.filter(id => id !== employeeId);
        }
    }

    private load(): DemoDatabase {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as DemoDatabase | null;
            if (stored && [...COLLECTIONS, 'users'].every(key => Array.isArray(stored[key as keyof DemoDatabase]))) {
                return stored;
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
    }
}

function randomId(): string {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export const demoBackendInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn,
) => inject(DemoBackend).handle(req) ?? next(req);
