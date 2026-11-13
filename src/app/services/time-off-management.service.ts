import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, merge, of } from 'rxjs';
import { catchError, concatMap, map, switchMap } from 'rxjs/operators';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffRequest } from '../infrastructure/types/time-off-request.type';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Notification } from '../infrastructure/types/notification';

@Injectable({ providedIn: 'root' })
export class TimeOffManagementService {
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  deleteRequest$ = new Subject<TimeOffRequest>();
  approveRequest$ = new Subject<TimeOffRequest>();
  rejectRequest$ = new Subject<TimeOffRequest>();
  createRequest$ = new Subject<Omit<TimeOffRequest, 'id' | 'status'>>();
  private readonly refresh$ = new Subject<void>();
  /** Why the last change was refused (over balance, outside your team…), or '' when it went through. */
  readonly error = signal('');
  selectedType = signal<
    | 'Vacation'
    | 'Sick Leave'
    | 'Maternity Leave'
    | 'Paternity Leave'
    | 'Other'
    | ''
  >((localStorage.getItem('selectedType') as any) ?? '');
  requests = toSignal(
    merge(
      toObservable(this.selectedType),
      this.refresh$,
      // concatMap, not switchMap: approving several requests in a row must
      // send every one, not cancel all but the last.
      this.deleteRequest$.pipe(
        concatMap((r) => this.attempt(this.timeOffRequestService.deleteRequest(r.id)))
      ),
      this.approveRequest$.pipe(
        concatMap((r) => this.attempt(this.timeOffRequestService.approveRequest(r.id)))
      ),
      this.rejectRequest$.pipe(
        concatMap((r) => this.attempt(this.timeOffRequestService.rejectRequest(r.id)))
      ),
      this.createRequest$.pipe(
        concatMap((r) => this.attempt(this.timeOffRequestService.createRequest(r)))
      )
    ).pipe(
      switchMap(() => {
        return this.timeOffRequestService.getRequestsByType(
          this.selectedType()
        );
      }),
      // Pending requests first, then by start date.
      map((requests) =>
        [...requests].sort(
          (a, b) =>
            Number(b.status === 'Pending') - Number(a.status === 'Pending') ||
            a.startDate.localeCompare(b.startDate)
        )
      )
    ),
    {
      initialValue: [] as TimeOffRequest[],
    }
  );
  resolvedRequests = computed(() =>
    this.requests().filter((r) => r.status !== 'Pending')
  );
  pendingRequests = computed(() =>
    this.requests().filter((r) => r.status === 'Pending')
  );

  constructor() {
    effect(() => {
      localStorage.setItem('selectedType', this.selectedType());
    });
  }

  /** Re-reads the list, for when another page may have changed it. */
  refresh() {
    this.refresh$.next();
  }

  /**
   * Runs one change. A refusal is reported through `error` and swallowed, so
   * the stream (and with it the whole list) survives to take the next action.
   */
  private attempt(action: Observable<unknown>): Observable<unknown> {
    this.error.set('');
    return action.pipe(
      catchError((error: HttpErrorResponse) => {
        this.error.set(error.error?.message ?? "That change didn't go through. Try again.");
        return of(null);
      })
    );
  }

  approveRequest(request: TimeOffRequest) {
    this.approveRequest$.next(request);
  }

  rejectRequest(request: TimeOffRequest) {
    this.rejectRequest$.next(request);
  }

  deleteRequest(request: TimeOffRequest) {
    this.deleteRequest$.next(request);
  }

  createRequest(request: Omit<TimeOffRequest, 'id' | 'status'>) {
    this.createRequest$.next(request);
  }
}
