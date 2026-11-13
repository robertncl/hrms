import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { AccessScope } from 'src/app/services/access-scope.service';
import { LeaveBalanceService } from 'src/app/services/leave-balance.service';
import { LeaveBalance, leaveBalances, leaveProblem, workingDays } from 'src/app/shared/functions/leave';
import { inScope } from 'src/app/shared/functions/org';
import { of } from 'rxjs';
import { TimeOffManagementService } from 'src/app/services/time-off-management.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { enableLightDismissFallback } from 'src/app/shared/functions/light-dismiss';
import { absenceType, clashInfo, formatRange } from 'src/app/shared/functions/absence';
import { daysFromToday } from 'src/app/demo/demo-data';
import { timelineBars, timelineWeeks, todayFraction } from './absence-timeline';

const REQUEST_TYPES: TimeOffRequest['type'][] = [
  'Vacation',
  'Sick Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Other',
];

type Tab = 'Pending' | 'Approved' | 'Rejected';

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const { startDate, endDate } = group.value as { startDate: string; endDate: string };
  return startDate && endDate && endDate < startDate ? { endBeforeStart: true } : null;
}

@Component({
  selector: 'app-time-off-management',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Time off</h1>
          <p>{{ summary() }}</p>
        </div>
        @if (canRequest()) {
          <div class="page-actions">
            <button class="btn btn-primary" type="button" (click)="openNewRequest()">Request time off</button>
          </div>
        }
      </div>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (ownBalances().length) {
        <section class="card balance-card" aria-labelledby="balance-title">
          <h2 id="balance-title">Your leave this year</h2>
          <dl class="balance-strip">
            @for (balance of ownBalances(); track balance.type) {
              <div>
                <dt>{{ leaveLabel(balance.type) }}</dt>
                <dd>
                  <strong>{{ balance.remaining }}</strong>&ngsp;
                  <span>of {{ balance.entitlement }} {{ balance.entitlement === 1 ? 'day' : 'days' }} left</span>
                  @if (balance.pending) {
                    &ngsp;<span class="muted">{{ balance.pending }} waiting for approval</span>
                  }
                </dd>
              </div>
            }
          </dl>
        </section>
      }

      <section class="card" aria-labelledby="timeline-title">
        <div class="card-header">
          <h2 id="timeline-title">Next six weeks</h2>
          <div class="legend">
            <span><span class="swatch"></span>Approved</span>
            <span><span class="swatch is-pending"></span>{{ canApprove() ? 'Waiting on you' : 'Waiting for approval' }}</span>
            <span><span class="swatch is-today"></span>Today</span>
          </div>
        </div>

        @if (bars().length) {
          <div class="timeline six" [style.--t-today]="todayAt()">
            <span></span>
            @for (week of weeks; track week.label) {
              <span class="t-head ruled" [style.grid-column]="week.column">{{ week.label }}</span>
            }
            @for (bar of bars(); track bar.id) {
              <span class="t-name">{{ bar.name }}</span>
              <span class="t-bar" [class.is-pending]="bar.pending"
                [style.grid-column]="bar.column">{{ bar.label }}</span>
            }
            <span class="t-today" aria-hidden="true"></span>
          </div>
        } @else {
          <p class="empty-state">Nobody is booked off in the next six weeks.</p>
        }
      </section>

      <section class="card flush" aria-labelledby="queue-title">
        <h2 id="queue-title" class="visually-hidden">{{ canApprove() ? 'Time off requests' : 'Your requests' }}</h2>
        <div class="tabs">
          @for (tab of tabs(); track tab.status) {
            <button class="tab" type="button" [attr.aria-selected]="status() === tab.status"
              (click)="status.set(tab.status)">{{ tab.label }} · {{ tab.count }}</button>
          }
          @if (canApprove() && status() === 'Pending' && clearCount()) {
            <button class="btn btn-sm push" type="button" (click)="approveClear()">
              Approve {{ clearCount() }} with no clashes
            </button>
          }
        </div>

        @if (visible().length) {
          <div class="rows">
            @for (row of visible(); track row.request.id) {
              <div class="row-item queue-row">
                <app-avatar [name]="row.name" size="2.25rem" />
                <div class="row-body person-cell">
                  <a [routerLink]="['/employees/details', row.request.employeeId]">{{ row.name }}</a>
                  <span class="row-note">{{ row.request.type }} · {{ row.dates }} · {{ row.days }}</span>
                </div>
                <div class="impact">
                  <span class="status" [class.is-away]="row.clash">{{ row.impact }}</span>
                  @if (row.request.comment) {
                    <span class="comment">&ldquo;{{ row.request.comment }}&rdquo;</span>
                  }
                </div>
                <div class="row-actions">
                  @if (row.decidable) {
                    @if (row.request.status === 'Pending') {
                      <button class="btn btn-sm btn-ghost" type="button" (click)="reject(row.request)">Decline</button>
                      <button class="btn btn-sm" type="button" (click)="approve(row.request)">Approve</button>
                    } @else {
                      <button class="btn btn-sm btn-quiet-danger" type="button"
                        (click)="remove(row.request)">Delete</button>
                    }
                  } @else if (row.request.status === 'Pending') {
                    <button class="btn btn-sm btn-ghost" type="button" (click)="remove(row.request)">Withdraw</button>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <p class="empty-state">{{ emptyMessage() }}</p>
        }
      </section>
    </div>

    <dialog #newRequestDialog closedby="any" aria-labelledby="new-request-title" (close)="newRequestForm.reset()">
      <h2 id="new-request-title">Request time off</h2>
      <form [formGroup]="newRequestForm" (ngSubmit)="submitNewRequest()" novalidate>
        <div class="form-grid">
          <div class="field span-all">
            <label for="request-employee">Person</label>
            @if (!canApprove()) {
              <span class="hint">You can book time off for yourself. Your lead approves it.</span>
            } @else if (!orgWide()) {
              <span class="hint">You can book time off for yourself and for the people who report to you.</span>
            }
            <select id="request-employee" formControlName="employeeId" [attr.aria-invalid]="showError('employeeId')">
              <option [ngValue]="null" disabled>Choose a person</option>
              @for (employee of bookable(); track employee.id) {
                <option [ngValue]="employee.id">{{ employee.firstName }} {{ employee.lastName }}</option>
              }
            </select>
            @if (showError('employeeId')) {
              <span class="error-msg">Choose who the request is for.</span>
            }
          </div>
          <div class="field span-all">
            <label for="request-type">Type</label>
            <select id="request-type" formControlName="type">
              @for (type of requestTypes; track type) {
                <option [ngValue]="type">{{ type }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="request-start">First day</label>
            <input id="request-start" type="date" formControlName="startDate" [attr.aria-invalid]="showError('startDate')" />
            @if (showError('startDate')) {
              <span class="error-msg">Pick a start date.</span>
            }
          </div>
          <div class="field">
            <label for="request-end">Last day</label>
            <input id="request-end" type="date" formControlName="endDate" [min]="newRequestForm.value.startDate ?? ''"
              [attr.aria-invalid]="showError('endDate') || endBeforeStart()" aria-describedby="request-end-error" />
            @if (showError('endDate')) {
              <span id="request-end-error" class="error-msg">Pick an end date.</span>
            } @else if (endBeforeStart()) {
              <span id="request-end-error" class="error-msg">The last day can't be before the first day.</span>
            }
          </div>
          @if (preview(); as preview) {
            <p class="span-all leave-preview" [class.is-problem]="preview.problem" role="status">
              @if (preview.problem) {
                {{ preview.problem }}
              } @else {
                Uses <strong>{{ preview.days }}</strong> working {{ preview.days === 1 ? 'day' : 'days' }}.
                @if (preview.balance; as balance) {
                  {{ balance.remaining - preview.days }} of {{ balance.entitlement }} left afterwards.
                } @else {
                  This type of leave has no yearly limit.
                }
              }
            </p>
          }
          <div class="field span-all">
            <label for="request-comment">Comment <span class="acme-label__optional">(optional)</span></label>
            <textarea id="request-comment" formControlName="comment" rows="3"></textarea>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn" type="button" (click)="newRequestDialog.close()">Cancel</button>
          <button class="btn btn-primary" type="submit" [disabled]="!!preview()?.problem">Send request</button>
        </div>
      </form>
    </dialog>
    `,
  styles: `
    .balance-card h2 { margin-bottom: var(--acme-space-3); }
    .balance-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
      gap: var(--acme-space-4);
      margin: 0;
    }
    .balance-strip dt { color: var(--acme-color-text-muted); font-size: var(--acme-text-sm); }
    .balance-strip dd { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--acme-space-2); margin: 0; font-size: var(--acme-text-sm); }
    .balance-strip strong { font: 700 var(--acme-text-2xl) / 1.1 var(--acme-font-display); }
    .leave-preview { margin: 0; font-size: var(--acme-text-sm); color: var(--acme-color-text-muted); }
    .leave-preview.is-problem { color: var(--acme-color-danger); }

    /* A name column plus one column per day across six weeks. */
    .timeline.six { grid-template-columns: 150px repeat(42, minmax(0, 1fr)); }
    .timeline.six .t-today { left: calc(150px + (100% - 150px) * var(--t-today)); }

    .queue-row { grid-template-columns: 36px minmax(0, 1.3fr) minmax(0, 1.6fr) auto; }

    .person-cell a {
      color: var(--acme-color-text);
      font-size: var(--acme-text-sm);
      font-weight: 600;
      text-decoration: none;
    }
    .person-cell a:hover { color: var(--acme-color-link); text-decoration: underline; }

    .impact { display: grid; gap: 2px; min-width: 0; }
    .comment {
      font-size: var(--acme-text-xs);
      color: var(--acme-color-text-subtle);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @media (max-width: 1100px) {
      .timeline.six { grid-template-columns: 110px repeat(42, minmax(0, 1fr)); font-size: var(--acme-text-xs); }
      .timeline.six .t-today { left: calc(110px + (100% - 110px) * var(--t-today)); }
      .queue-row { grid-template-columns: 36px minmax(0, 1fr) auto; }
      .impact { grid-column: 2 / -1; }
    }

    @media (max-width: 640px) {
      .queue-row { grid-template-columns: 36px minmax(0, 1fr); }
    }
  `,
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AvatarComponent],
})
export class TimeOffManagementComponent {
  private readonly timeOffsService = inject(TimeOffManagementService);
  private readonly employeeService = inject(EmployeeService);
  private readonly newRequestDialog = viewChild.required<ElementRef<HTMLDialogElement>>('newRequestDialog');

  readonly requestTypes = REQUEST_TYPES;
  readonly weeks = timelineWeeks();
  readonly todayAt = signal(todayFraction());

  status = signal<Tab>('Pending');

  private readonly access = inject(AccessScope);
  private readonly leaveBalanceService = inject(LeaveBalanceService);
  canApprove = inject(PermissionsService).can('ApproveTimeOff');
  readonly orgWide = this.access.orgWide;
  readonly error = this.timeOffsService.error;
  /** The signed-in person's own People record, if they have one. */
  private readonly ownId = this.access.ownId;
  /** Approvers book for anyone; everyone else only for themselves. */
  canRequest = computed(() => this.canApprove() || this.ownId() !== undefined);

  /** The service filters by type; the timeline and tabs need every request. */
  allRequests = this.timeOffsService.requests;

  employees = toSignal(this.employeeService.getEmployees(), { initialValue: [] });

  private readonly names = computed(
    () => new Map(this.employees().map((e) => [e.id, `${e.firstName} ${e.lastName}`])),
  );

  bars = computed(() => timelineBars(this.allRequests(), this.employees()));

  private readonly byId = computed(() => new Map(this.employees().map((e) => [e.id, e])));
  /** Whose requests this viewer decides: everyone for HR, their reporting line for a lead. */
  private readonly scope = computed(() => this.access.of(this.employees()));
  private decides(employeeId: number): boolean {
    return this.canApprove() && inScope(this.scope(), employeeId);
  }

  /** The requests this viewer decides, plus their own. Everyone else's stay on the calendar only. */
  private readonly rows = computed(() =>
    this.allRequests()
      .filter((request) => this.decides(request.employeeId) || request.employeeId === this.ownId())
      .map((request) => {
        const { text, clash } = clashInfo(request, this.allRequests(), this.employees());
        // Leave is counted in working days: weekends and public holidays are free.
        const days = workingDays(request.startDate, request.endDate, this.byId().get(request.employeeId)?.location);
        return {
          request,
          decidable: this.decides(request.employeeId),
          name: this.names().get(request.employeeId) ?? `Employee #${request.employeeId}`,
          dates: formatRange(request.startDate, request.endDate),
          days: `${days} ${days === 1 ? 'day' : 'days'}`,
          impact: text,
          clash,
        };
      }),
  );

  tabs = computed(() => {
    const rows = this.rows();
    return (['Pending', 'Approved', 'Rejected'] as Tab[]).map((status) => ({
      status,
      label: status === 'Pending' ? 'Waiting' : status === 'Approved' ? 'Approved' : 'Declined',
      count: rows.filter((row) => row.request.status === status).length,
    }));
  });

  visible = computed(() =>
    this.rows()
      .filter((row) => row.request.status === this.status())
      .sort((a, b) => a.request.startDate.localeCompare(b.request.startDate)),
  );

  /** Pending requests nobody else's absence collides with. */
  private readonly clearRequests = computed(() =>
    this.rows().filter((row) => row.decidable && row.request.status === 'Pending' && !row.clash),
  );
  clearCount = computed(() => this.clearRequests().length);

  summary = computed(() => {
    const pending = this.rows().filter((row) => row.request.status === 'Pending');
    // Approvers are told what waits on them; their own request waits on someone else.
    const waiting = pending.filter((row) => row.decidable || !this.canApprove()).length;
    if (!this.canApprove()) {
      if (this.ownId() === undefined) return 'Who is out over the next six weeks.';
      return waiting
        ? `${waiting === 1 ? 'Your request is' : `${waiting} of your requests are`} waiting for approval.`
        : 'Nothing of yours is waiting. Book time off and your lead is asked to approve it.';
    }
    return waiting
      ? `${waiting} ${waiting === 1 ? 'request is' : 'requests are'} waiting. See who else is out before you decide.`
      : 'Nothing waiting. The next six weeks are below.';
  });

  emptyMessage = computed(() => {
    const yours = !this.canApprove();
    switch (this.status()) {
      case 'Pending':
        return yours ? 'You have nothing waiting.' : 'Nothing waiting on you.';
      case 'Approved':
        return yours ? 'None of your requests are approved yet.' : 'Nothing approved yet.';
      default:
        return yours ? 'None of your requests were declined.' : 'Nothing declined.';
    }
  });

  newRequestForm = new FormGroup(
    {
      employeeId: new FormControl<number | null>(null, Validators.required),
      type: new FormControl<TimeOffRequest['type']>('Vacation', { nonNullable: true }),
      startDate: new FormControl('', { nonNullable: true, validators: Validators.required }),
      endDate: new FormControl('', { nonNullable: true, validators: Validators.required }),
      comment: new FormControl('', { nonNullable: true }),
    },
    { validators: endAfterStart },
  );

  /** The signed-in person's balances, re-read whenever the requests change. */
  private readonly balanceResource = rxResource({
    params: () => ({ ownId: this.ownId(), requests: this.allRequests() }),
    stream: ({ params }) =>
      params.ownId === undefined ? of([] as LeaveBalance[]) : this.leaveBalanceService.getBalances(params.ownId),
  });
  ownBalances = computed(() => (this.balanceResource.hasValue() ? this.balanceResource.value() : []));
  leaveLabel = (type: LeaveBalance['type']) => (type === 'Other' ? 'Personal' : absenceType(type));

  /** Who a request can be booked for: yourself, and whoever you approve for. */
  bookable = computed(() =>
    this.employees().filter((e) => e.id === this.ownId() || this.decides(e.id)),
  );

  /** Bumped on every change to the request form, which is not itself a signal. */
  private readonly formChanges = toSignal(this.newRequestForm.valueChanges);

  /**
   * What the request in the dialog would cost, checked with the same rules
   * the API applies, so a request that can't be booked is caught before it
   * is sent.
   */
  preview = computed(() => {
    this.formChanges();
    const { employeeId, type, startDate, endDate } = this.newRequestForm.getRawValue();
    const person = employeeId === null ? undefined : this.byId().get(employeeId);
    if (!person || !startDate || !endDate) return null;
    const problem = leaveProblem(person, this.allRequests(), { type, startDate, endDate });
    if (problem) return { problem, days: 0, balance: undefined };
    const year = new Date(`${startDate}T00:00:00`).getFullYear();
    return {
      problem,
      days: workingDays(startDate, endDate, person.location),
      balance: leaveBalances(person, this.allRequests(), year).find((b) => b.type === type),
    };
  });

  constructor() {
    afterNextRender(() => enableLightDismissFallback(this.newRequestDialog().nativeElement));
    // The page has no type filter any more, and other pages approve requests
    // too: always start from the full, current list.
    this.timeOffsService.selectedType.set('');
    this.timeOffsService.refresh();
  }

  showError(name: 'employeeId' | 'startDate' | 'endDate') {
    const control = this.newRequestForm.controls[name];
    return control.touched && control.invalid;
  }

  endBeforeStart() {
    return this.newRequestForm.controls.endDate.touched && this.newRequestForm.hasError('endBeforeStart');
  }

  openNewRequest() {
    const today = daysFromToday(0);
    const forSelf = !this.canApprove();
    this.newRequestForm.reset({
      employeeId: forSelf ? (this.ownId() ?? null) : null,
      type: 'Vacation',
      startDate: today,
      endDate: today,
      comment: '',
    });
    // Without approval rights the request can only be for yourself.
    if (forSelf) {
      this.newRequestForm.controls.employeeId.disable();
    } else {
      this.newRequestForm.controls.employeeId.enable();
    }
    this.newRequestDialog().nativeElement.showModal();
  }

  submitNewRequest() {
    if (this.newRequestForm.invalid || this.preview()?.problem) {
      this.newRequestForm.markAllAsTouched();
      return;
    }
    const { employeeId, type, startDate, endDate, comment } = this.newRequestForm.getRawValue();
    this.timeOffsService.createRequest({
      employeeId: employeeId!,
      type,
      startDate,
      endDate,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    this.newRequestDialog().nativeElement.close();
  }

  approve(request: TimeOffRequest) {
    this.timeOffsService.approveRequest(request);
  }

  reject(request: TimeOffRequest) {
    this.timeOffsService.rejectRequest(request);
  }

  remove(request: TimeOffRequest) {
    this.timeOffsService.deleteRequest(request);
  }

  /**
   * Approve every pending request with no cover clash in one go. Clashing
   * requests are deliberately left for a person to weigh up.
   */
  approveClear() {
    for (const row of this.clearRequests()) {
      this.timeOffsService.approveRequest(row.request);
    }
  }
}
