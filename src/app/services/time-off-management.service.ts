import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subject, merge } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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
      this.deleteRequest$.pipe(
        switchMap((r) => this.timeOffRequestService.deleteRequest(r.id))
      ),
      this.approveRequest$.pipe(
        switchMap((r) => this.timeOffRequestService.approveRequest(r.id))
      ),
      this.rejectRequest$.pipe(
        switchMap((r) => this.timeOffRequestService.rejectRequest(r.id))
      ),
      this.createRequest$.pipe(
        switchMap((r) => this.timeOffRequestService.createRequest(r))
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
