import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Observable, forkJoin } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { Enrollment } from 'src/app/infrastructure/types/course';
import { CourseService } from 'src/app/services/course.service';
import { EnrollmentService } from 'src/app/services/enrollment.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { ConfirmationDialogComponent } from 'src/app/shared/components/confirmation-dialog.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { ProgressMeterComponent } from 'src/app/shared/components/progress-meter.component';
import { enableLightDismissFallback } from 'src/app/shared/functions/light-dismiss';
import { daysFromToday } from 'src/app/demo/demo-data';
import { completionRate, enrollmentLabel, enrollmentTone, formatDuration, isOverdue } from './learning';

const DEFAULT_DUE_DAYS = 30;

@Component({
  selector: 'app-course-details',
  template: `
    <div class="page">
      <a class="back-link" routerLink="/learning"><app-icon name="arrow-left" [size]="16" /> Learning</a>

      @if (data.hasValue()) {
        @let course = data.value().course;
        <div class="page-header">
          <div>
            <div class="course-tags">
              <span class="tag">{{ course.category }}</span>
              @if (course.mandatory) {
                <span class="badge badge-info">Mandatory</span>
              }
            </div>
            <h1>{{ course.title }}</h1>
            <p>{{ course.format }} · {{ duration(course) }} · {{ course.modules.length }} modules</p>
          </div>
          <div class="page-actions">
            @if (canManage()) {
              <a class="btn" [routerLink]="['/learning/courses', course.id, 'edit']">Edit</a>
              <button class="btn" type="button" (click)="confirmingDelete.set(true)">Delete</button>
            }
            <button class="btn btn-primary" type="button" (click)="openAssign()">
              <app-icon name="plus" /> Assign employees
            </button>
          </div>
        </div>

        @if (actionError()) {
          <p class="alert alert-error" role="alert">{{ actionError() }}</p>
        }

        <div class="layout">
          <section class="card">
            <h2>About this course</h2>
            <p class="description">{{ course.description }}</p>
            <h3 class="modules-title">Modules</h3>
            <ol class="modules">
              @for (module of course.modules; track $index) {
                <li>{{ module }}</li>
              }
            </ol>
          </section>
          <section class="card">
            <h2>Summary</h2>
            <dl class="details-list">
              <dt>Enrolled</dt><dd>{{ enrollments().length }}</dd>
              <dt>Completed</dt><dd>{{ completedCount() }}</dd>
              <dt>Overdue</dt><dd>{{ overdueCount() }}</dd>
            </dl>
            <div class="summary-meter">
              <span class="muted small">Completion</span>
              <app-progress-meter [value]="rate()" label="Course completion" />
            </div>
          </section>
        </div>

        <section class="enrolled" aria-labelledby="enrolled-title">
          <h2 id="enrolled-title">Enrolled employees</h2>
          <div class="table-wrap">
            <table class="data-table stack">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Status</th>
                  <th scope="col">Due</th>
                  <th scope="col" class="actions"><span class="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (enrollment of enrollments(); track enrollment.id) {
                  <tr>
                    <td>
                      <div class="person">
                        <app-avatar [name]="employeeName(enrollment.employeeId)" size="2rem" />
                        <div>
                          <a [routerLink]="['/employees/details', enrollment.employeeId]">{{ employeeName(enrollment.employeeId) }}</a>
                          <span class="muted">{{ employeeRole(enrollment.employeeId) }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="progress-cell" data-label="Progress">
                      <app-progress-meter [value]="enrollment.progress" [label]="employeeName(enrollment.employeeId) + ' progress'" />
                      <span class="muted small">{{ enrollment.completedModules }} of {{ course.modules.length }} modules</span>
                    </td>
                    <td><span [class]="'badge badge-' + tone(enrollment)">{{ statusLabel(enrollment) }}</span></td>
                    <td class="num" data-label="Due">
                      @if (enrollment.status === 'Completed') {
                        Done {{ enrollment.completedAt | date: 'MMM d' }}
                      } @else if (enrollment.dueDate) {
                        {{ enrollment.dueDate | date: 'MMM d, y' }}
                      } @else {
                        <span class="muted">No due date</span>
                      }
                    </td>
                    <td class="actions">
                      @if (enrollment.status !== 'Completed') {
                        <button class="btn btn-sm" type="button" [disabled]="busy()"
                          (click)="setModules(enrollment, enrollment.completedModules + 1)">Log module</button>
                        <button class="btn btn-sm" type="button" [disabled]="busy()"
                          (click)="setModules(enrollment, course.modules.length)">Mark complete</button>
                      }
                      <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()" (click)="unenroll(enrollment)">Unenroll</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="empty-state">Nobody is enrolled yet. Assign this course to get started.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <dialog #assignDialog closedby="any" aria-labelledby="assign-title" (close)="selected.set([])">
          <h2 id="assign-title">Assign “{{ course.title }}”</h2>
          <form (submit)="$event.preventDefault(); assign()" novalidate>
            <div class="field">
              <label for="assign-search">Find people</label>
              <input id="assign-search" type="search" placeholder="Search by name or position"
                [value]="assignSearch()" (input)="assignSearch.set($any($event.target).value)" />
            </div>
            <fieldset class="people">
              <legend>
                {{ selected().length }} selected
                @if (assignable().length) {
                  <button class="btn btn-sm btn-ghost" type="button" (click)="selectAllShown()">Select all shown</button>
                }
              </legend>
              @for (employee of assignable(); track employee.id) {
                <label class="person-option">
                  <input type="checkbox" [checked]="selected().includes(employee.id)" (change)="toggle(employee.id)" />
                  <app-avatar [name]="employee.firstName + ' ' + employee.lastName" size="1.75rem" />
                  <span>{{ employee.firstName }} {{ employee.lastName }} <span class="muted small">{{ employee.position }}</span></span>
                </label>
              } @empty {
                <p class="muted small">
                  {{ assignSearch() ? 'Nobody matches your search.' : 'Everyone is already enrolled.' }}
                </p>
              }
            </fieldset>
            <div class="field">
              <label for="assign-due">Due date <span class="muted">(optional)</span></label>
              <input id="assign-due" type="date" [min]="today" [value]="dueDate()" (input)="dueDate.set($any($event.target).value)" />
            </div>
            <div class="dialog-actions">
              <button class="btn" type="button" (click)="assignDialog.close()">Cancel</button>
              <button class="btn btn-primary" type="submit" [disabled]="busy() || !selected().length">
                Assign to {{ selected().length }} {{ selected().length === 1 ? 'person' : 'people' }}
              </button>
            </div>
          </form>
        </dialog>

        @if (confirmingDelete()) {
          <app-confirmation-dialog
            title="Delete course?"
            [message]="'“' + course.title + '” and its ' + enrollments().length + ' enrollments will be removed.'"
            confirmLabel="Delete course"
            [destructive]="true"
            [onConfirm]="deleteCourse"
            [onClose]="closeDelete" />
        }
      } @else if (data.error()) {
        <section class="card empty-state">
          <h1>Course not found</h1>
          <p>It may have been deleted. <a routerLink="/learning">Back to the catalog</a></p>
        </section>
      } @else {
        <p class="loading">Loading course…</p>
      }
    </div>
  `,
  styles: `
    .course-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-bottom: 0.4rem; }
    .layout {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      align-items: start;
    }
    .description { color: var(--text-secondary); max-width: 70ch; }
    .modules-title { margin: 1.25rem 0 0.5rem; }
    .modules { margin: 0; padding-inline-start: 1.25rem; display: grid; gap: 0.35rem; }
    .summary-meter { display: grid; gap: 0.3rem; margin-top: 1rem; }
    .enrolled { display: grid; gap: 0.75rem; }
    .progress-cell { min-width: 11rem; }
    .progress-cell .small { display: block; }
    .people {
      display: grid;
      gap: 0.25rem;
      max-height: 16rem;
      overflow-y: auto;
      margin: 1rem 0;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .people legend {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.35rem;
      font-size: 0.88rem;
      font-weight: 600;
    }
    .person-option {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.3rem 0.25rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    .person-option:hover { background: var(--surface-hover); }
    .person-option input { width: 1.05rem; height: 1.05rem; }
    @media (max-width: 860px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  imports: [DatePipe, RouterLink, AvatarComponent, ConfirmationDialogComponent, IconComponent, ProgressMeterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseDetailsComponent {
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly employeeService = inject(EmployeeService);
  private readonly router = inject(Router);
  private readonly assignDialog = viewChild<ElementRef<HTMLDialogElement>>('assignDialog');

  /** Route parameter. */
  id = input.required({ transform: numberAttribute });
  canManage = toSignal(inject(PermissionsService).hasPermission('ManageCourses'), { initialValue: false });

  readonly duration = formatDuration;
  readonly tone = enrollmentTone;
  readonly statusLabel = enrollmentLabel;
  readonly today = daysFromToday(0);

  data = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) =>
      forkJoin({
        course: this.courseService.getCourse(id),
        enrollments: this.enrollmentService.getEnrollmentsByCourse(id),
        employees: this.employeeService.getEmployees(),
      }),
  });

  busy = signal(false);
  actionError = signal('');
  confirmingDelete = signal(false);
  selected = signal<number[]>([]);
  assignSearch = signal('');
  dueDate = signal(daysFromToday(DEFAULT_DUE_DAYS));

  private readonly employees = computed(() => (this.data.hasValue() ? this.data.value().employees : []));
  private readonly employeesById = computed(() => new Map(this.employees().map((e) => [e.id, e])));

  /** Unfinished first (overdue at the top), then completed. */
  enrollments = computed(() => {
    const enrollments = this.data.hasValue() ? this.data.value().enrollments : [];
    const rank = (e: Enrollment) => (isOverdue(e) ? 0 : e.status === 'Completed' ? 2 : 1);
    return [...enrollments].sort(
      (a, b) => rank(a) - rank(b) || this.employeeName(a.employeeId).localeCompare(this.employeeName(b.employeeId)),
    );
  });
  completedCount = computed(() => this.enrollments().filter((e) => e.status === 'Completed').length);
  overdueCount = computed(() => this.enrollments().filter((e) => isOverdue(e)).length);
  rate = computed(() => completionRate(this.enrollments()));

  /** Employees who can still be assigned, filtered by the dialog's search. */
  assignable = computed(() => {
    const enrolled = new Set(this.enrollments().map((e) => e.employeeId));
    const term = this.assignSearch().trim().toLowerCase();
    return this.employees().filter(
      (e: Employee) =>
        !enrolled.has(e.id) && (!term || `${e.firstName} ${e.lastName} ${e.position}`.toLowerCase().includes(term)),
    );
  });

  employeeName(id: number): string {
    const employee = this.employeesById().get(id);
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${id}`;
  }

  employeeRole(id: number): string {
    const employee = this.employeesById().get(id);
    return employee ? `${employee.position} · ${employee.level}` : '';
  }

  openAssign() {
    this.assignSearch.set('');
    this.selected.set([]);
    this.dueDate.set(daysFromToday(DEFAULT_DUE_DAYS));
    const dialog = this.assignDialog()?.nativeElement;
    if (dialog) {
      enableLightDismissFallback(dialog);
      dialog.showModal();
    }
  }

  toggle(employeeId: number) {
    this.selected.update((ids) => (ids.includes(employeeId) ? ids.filter((id) => id !== employeeId) : [...ids, employeeId]));
  }

  selectAllShown() {
    this.selected.update((ids) => [...new Set([...ids, ...this.assignable().map((e) => e.id)])]);
  }

  assign() {
    if (!this.selected().length) return;
    this.run(this.enrollmentService.assign(this.id(), this.selected(), this.dueDate() || undefined), () =>
      this.assignDialog()?.nativeElement.close(),
    );
  }

  setModules(enrollment: Enrollment, completedModules: number) {
    this.run(this.enrollmentService.setCompletedModules(enrollment.id, completedModules));
  }

  unenroll(enrollment: Enrollment) {
    this.run(this.enrollmentService.unenroll(enrollment.id));
  }

  // Arrow functions: passed to the confirmation dialog as callbacks.
  deleteCourse = () => {
    this.courseService.deleteCourse(this.id()).subscribe({
      next: () => this.router.navigate(['/learning']),
      error: () => this.actionError.set('The course could not be deleted. Please try again.'),
    });
  };

  closeDelete = () => this.confirmingDelete.set(false);

  /** Runs a change, then reloads the page data. */
  private run(action: Observable<unknown>, done?: () => void) {
    this.busy.set(true);
    this.actionError.set('');
    action.subscribe({
      next: () => {
        this.busy.set(false);
        done?.();
        this.data.reload();
      },
      error: () => {
        this.busy.set(false);
        this.actionError.set('That change could not be saved. Please try again.');
      },
    });
  }
}
