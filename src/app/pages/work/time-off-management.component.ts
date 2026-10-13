import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { EmployeeService } from 'src/app/services/employee.service';
import { TimeOffManagementService } from 'src/app/services/time-off-management.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { enableLightDismissFallback } from 'src/app/shared/functions/light-dismiss';
import { timeOffTone } from 'src/app/shared/functions/status-badge';
import { daysFromToday } from 'src/app/demo/demo-data';

const REQUEST_TYPES: TimeOffRequest['type'][] = [
  'Vacation',
  'Sick Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Other',
];

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
          <h1>Time Off Management</h1>
          <p class="summary">
            <span class="badge badge-warning">{{ pendingCount() }} pending</span>
            <span class="badge badge-good">{{ approvedCount() }} approved</span>
            <span class="badge badge-critical">{{ rejectedCount() }} rejected</span>
          </p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" type="button" (click)="openNewRequest()">
            <app-icon name="plus" /> New request
          </button>
        </div>
      </div>

      <div class="toolbar">
        <label for="time-off-type" class="muted small">Type</label>
        <select
          id="time-off-type"
          class="input"
          [ngModel]="selectedType()"
          (ngModelChange)="selectedType.set($any($event))"
          >
          <option value="">All</option>
          <option value="Vacation">Vacation</option>
          <option value="Sick Leave">Sick Leave</option>
          <option value="Maternity Leave">Maternity Leave</option>
          <option value="Paternity Leave">Paternity Leave</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="data-table stack">
          <thead>
            <tr>
              <th scope="col">Employee</th>
              <th scope="col">Dates</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Comment</th>
              <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (request of requests(); track request.id) {
              <tr>
                <td>
                  <div class="person">
                    <app-avatar [name]="employeeName(request.employeeId)" size="2rem" />
                    <a [routerLink]="['/employees/details', request.employeeId]">{{ employeeName(request.employeeId) }}</a>
                  </div>
                </td>
                <td class="num" data-label="Dates">
                  {{ request.startDate | date }}
                  @if (request.endDate !== request.startDate) { – {{ request.endDate | date }} }
                  <span class="muted small">{{ dayCount(request) }} {{ dayCount(request) === 1 ? 'day' : 'days' }}</span>
                </td>
                <td data-label="Type">{{ request.type }}</td>
                <td><span [class]="'badge badge-' + tone(request.status)">{{ request.status }}</span></td>
                @if (request.comment) {
                  <td class="comment" data-label="Comment">{{ request.comment }}</td>
                } @else {
                  <td class="comment"></td>
                }
                <td class="actions">
                  @if (request.status === 'Pending') {
                    <button class="btn btn-sm" (click)="approveRequest(request)">Approve</button>
                    <button class="btn btn-sm" (click)="rejectRequest(request)">Reject</button>
                  }
                  <button class="btn btn-sm btn-ghost" (click)="deleteRequest(request)">Delete</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty-state">No time off requests.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <dialog #newRequestDialog closedby="any" aria-labelledby="new-request-title" (close)="newRequestForm.reset()">
      <h2 id="new-request-title">New time off request</h2>
      <form [formGroup]="newRequestForm" (ngSubmit)="submitNewRequest()" novalidate>
        <div class="form-grid">
          <div class="field span-all">
            <label for="request-employee">Employee</label>
            <select id="request-employee" formControlName="employeeId" [attr.aria-invalid]="showError('employeeId')">
              <option [ngValue]="null" disabled>Choose an employee</option>
              @for (employee of employees(); track employee.id) {
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
          <div class="field span-all">
            <label for="request-comment">Comment <span class="muted">(optional)</span></label>
            <textarea id="request-comment" formControlName="comment" rows="3"></textarea>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn" type="button" (click)="newRequestDialog.close()">Cancel</button>
          <button class="btn btn-primary" type="submit">Submit request</button>
        </div>
      </form>
    </dialog>
    `,
  styles: `
    .summary { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
    .num .small { display: block; }
    .comment { max-width: 18rem; color: var(--text-secondary); }
    .person { min-width: 10rem; }
  `,
  standalone: true,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, RouterLink, AvatarComponent, IconComponent],
})
export class TimeOffManagementComponent {
  private readonly timeOffsService = inject(TimeOffManagementService);
  private readonly employeeService = inject(EmployeeService);
  private readonly newRequestDialog = viewChild.required<ElementRef<HTMLDialogElement>>('newRequestDialog');

  readonly requestTypes = REQUEST_TYPES;
  requests = this.timeOffsService.requests;
  resolvedRequests = this.timeOffsService.resolvedRequests;
  selectedType = this.timeOffsService.selectedType;
  pendingCount = computed(() => this.requests().length - this.resolvedRequests().length);
  approvedCount = computed(() => this.requests().filter((r) => r.status === 'Approved').length);
  rejectedCount = computed(() => this.requests().filter((r) => r.status === 'Rejected').length);

  employees = toSignal(this.employeeService.getEmployees(), { initialValue: [] });
  private readonly employeeNames = computed(
    () => new Map(this.employees().map((e) => [e.id, `${e.firstName} ${e.lastName}`])),
  );

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

  constructor() {
    afterNextRender(() => enableLightDismissFallback(this.newRequestDialog().nativeElement));
  }

  tone = timeOffTone;

  employeeName(id: number) {
    return this.employeeNames().get(id) ?? `Employee #${id}`;
  }

  dayCount(request: TimeOffRequest) {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
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
    this.newRequestForm.reset({ employeeId: null, type: 'Vacation', startDate: today, endDate: today, comment: '' });
    this.newRequestDialog().nativeElement.showModal();
  }

  submitNewRequest() {
    if (this.newRequestForm.invalid) {
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

  approveRequest(request: TimeOffRequest) {
    this.timeOffsService.approveRequest(request);
  }

  rejectRequest(request: TimeOffRequest) {
    this.timeOffsService.rejectRequest(request);
  }

  deleteRequest(request: TimeOffRequest) {
    this.timeOffsService.deleteRequest(request);
  }
}
