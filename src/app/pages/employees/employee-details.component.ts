import { NgOptimizedImage } from '@angular/common';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { Project } from 'src/app/infrastructure/types/project';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { EmployeeService } from 'src/app/services/employee.service';
import { ProjectService } from 'src/app/services/project.service';
import { TimeOffRequestService } from 'src/app/services/time-off-request.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { ProgressMeterComponent } from 'src/app/shared/components/progress-meter.component';
import { CourseService } from 'src/app/services/course.service';
import { EnrollmentService } from 'src/app/services/enrollment.service';
import { Enrollment } from 'src/app/infrastructure/types/course';
import { enrollmentLabel, enrollmentTone, isOverdue } from '../learning/learning';
import { clashInfo, dayCount, formatDay, formatRange } from 'src/app/shared/functions/absence';
import { awayLabels } from './people-table';
import { AuthService } from 'src/app/services/auth.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { formatLongDate, tenure } from 'src/app/shared/functions/tenure';

@Component({
  selector: 'app-employee-details',
  template: `
    <div class="page">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a routerLink="/employees">People</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ fullName }}</span>
      </nav>

      <div class="profile-head">
        <app-avatar [name]="fullName" [src]="employee.profilePicture"
          [away]="!employee.isAvailable" size="4.5rem" />
        <div class="who">
          <h1>{{ fullName }}</h1>
          <div class="meta">
            <span>{{ employee.level }} {{ employee.position.toLowerCase() }}</span>
            <span aria-hidden="true">·</span>
            <a [href]="'mailto:' + employee.email">{{ employee.email }}</a>
            <span aria-hidden="true">·</span>
            <span class="status" [class.is-away]="!employee.isAvailable">{{ statusLabel() }}</span>
          </div>
        </div>
        @if (canEdit()) {
          <div class="page-actions">
            <a class="btn btn-primary" [routerLink]="['/employees/edit', employee.id]">Edit details</a>
          </div>
        }
      </div>

      <div class="split even">
        <div class="stack">
          @if (canApprove() && pending(); as request) {
            <section class="callout" aria-labelledby="pending-title">
              <div class="callout-body">
                <strong id="pending-title">
                  {{ employee.firstName }} asked for {{ formatRange(request.startDate, request.endDate) }} off
                </strong>
                <span>
                  {{ request.type }}, {{ days(request) }}.
                  {{ impact() }}{{ request.comment ? ' “' + request.comment + '”' : '' }}
                </span>
              </div>
              <button class="btn btn-sm btn-ghost" type="button" [disabled]="busy()"
                (click)="resolve(request, 'Rejected')">Decline</button>
              <button class="btn btn-sm btn-primary" type="button" [disabled]="busy()"
                (click)="resolve(request, 'Approved')">Approve</button>
            </section>
          }

          <section class="card" aria-labelledby="projects-title">
            <h2 id="projects-title">Projects</h2>
            @if (loaded()) {
              @if (projects().length) {
                <div class="rows project-rows">
                  @for (project of projects(); track project.id) {
                    <div class="project-row">
                      @if (project.image) {
                        <div class="thumb">
                          <img [ngSrc]="project.image" [loaderParams]="{ src: project.image }" fill
                            disableOptimizedSrcset alt="" />
                        </div>
                      }
                      <div class="p-body">
                        <a [routerLink]="['/work/projects', project.id]">{{ project.name }}</a>
                        <span class="muted small">{{ project.description }}</span>
                      </div>
                      <span class="muted small num">
                        {{ project.employees.length }} {{ project.employees.length === 1 ? 'person' : 'people' }}
                      </span>
                    </div>
                  }
                </div>
              } @else {
                <p class="muted small">Not on a project yet.</p>
              }
            } @else {
              <p class="loading">Loading projects…</p>
            }
          </section>

          <section class="card" aria-labelledby="learning-title">
            <div class="card-header">
              <h2 id="learning-title">Learning</h2>
              @if (training().length) {
                <span class="small muted">{{ completedTraining() }} of {{ training().length }} complete</span>
              }
            </div>
            @if (loaded()) {
              @if (training().length) {
                <div class="rows learning-rows">
                  @for (item of training(); track item.enrollment.id) {
                    <div class="learning-row">
                      <div class="l-body">
                        <a [routerLink]="['/learning/courses', item.enrollment.courseId]">{{ item.title }}</a>
                        <span class="muted small">{{ dueLabel(item.enrollment) }}</span>
                      </div>
                      <app-progress-meter [value]="item.enrollment.progress"
                        [label]="item.title + ' progress'" />
                      <span [class]="'badge badge-' + tone(item.enrollment)">
                        {{ courseStatus(item.enrollment) }}
                      </span>
                    </div>
                  }
                </div>
              } @else {
                <p class="muted small">No training assigned.</p>
              }
            } @else {
              <p class="loading">Loading training…</p>
            }
          </section>
        </div>

        <div class="stack">
          <section class="card" aria-labelledby="details-title">
            <h2 id="details-title">Details</h2>
            <dl class="details-list">
              <dt>Role</dt><dd>{{ employee.position }}</dd>
              <dt>Level</dt><dd>{{ employee.level }}</dd>
              <dt>Email</dt><dd>{{ employee.email }}</dd>
              <dt>Location</dt><dd>{{ employee.location || '—' }}</dd>
              <dt>Started</dt>
              <dd>
                @if (employee.startDate) {
                  {{ longDate(employee.startDate) }} <span class="muted">· {{ tenure(employee.startDate) }}</span>
                } @else {
                  —
                }
              </dd>
              <dt>Reports to</dt>
              <dd>
                @if (manager(); as manager) {
                  <a [routerLink]="['/employees/details', manager.id]">{{ manager.firstName }} {{ manager.lastName }}</a>
                } @else {
                  —
                }
              </dd>
              @if (reports().length) {
                <dt>Direct reports</dt>
                <dd class="reports">
                  @for (report of reports(); track report.id; let last = $last) {
                    <a [routerLink]="['/employees/details', report.id]">{{ report.firstName }} {{ report.lastName }}</a>{{ last ? '' : ', ' }}
                  }
                </dd>
              }
              <dt>Status</dt><dd>{{ statusLabel() }}</dd>
              <dt>Employee ID</dt><dd class="num">#{{ employee.id }}</dd>
            </dl>
          </section>

          @if (canSeePrivate()) {
            <section class="card" aria-labelledby="private-title" aria-describedby="private-note">
              <h2 id="private-title">Private details</h2>
              <p id="private-note" class="small muted private-note">
                {{ isSelf() ? 'Only you and HR see these.' : 'Only HR and ' + employee.firstName + ' see these.' }}
              </p>
              <dl class="details-list">
                <dt>Phone</dt>
                <dd>
                  @if (employee.phone) {
                    <a [href]="'tel:' + employee.phone.replaceAll(' ', '')">{{ employee.phone }}</a>
                  } @else {
                    —
                  }
                </dd>
                <dt>Personal email</dt>
                <dd>
                  @if (employee.personalEmail) {
                    <a [href]="'mailto:' + employee.personalEmail">{{ employee.personalEmail }}</a>
                  } @else {
                    —
                  }
                </dd>
              </dl>
            </section>
          }

          <section class="card" aria-labelledby="timeoff-title">
            <div class="card-header">
              <h2 id="timeoff-title">Time off</h2>
              <a class="small" routerLink="/work/time-off">All requests</a>
            </div>
            @if (history().length) {
              <div class="rows time-rows">
                @for (request of history(); track request.id) {
                  <div class="time-row">
                    <div class="t-body">
                      <strong>{{ formatRange(request.startDate, request.endDate) }}</strong>
                      <span class="muted small">{{ request.type }} · {{ days(request) }}</span>
                    </div>
                    <span class="badge" [class.badge-selected]="request.status === 'Pending'"
                      [class.badge-critical]="request.status === 'Rejected'">
                      {{ request.status === 'Pending' ? (canApprove() ? 'Waiting on you' : 'Waiting for approval') : request.status }}
                    </span>
                  </div>
                }
              </div>
            } @else {
              <p class="muted small">No time off booked.</p>
            }
          </section>
        </div>
      </div>

    </div>
    `,
  styles: `
    .profile-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--acme-space-5);
    }
    .profile-head .who { flex: 1 1 18rem; }
    .profile-head h1 { margin: 0; }

    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--acme-space-3);
      margin-top: var(--acme-space-2);
      font-size: var(--acme-text-sm);
      color: var(--acme-color-text-muted);
    }
    .meta a { text-decoration: none; }
    .meta a:hover { text-decoration: underline; }

    .project-row,
    .time-row {
      display: grid;
      align-items: center;
      gap: var(--acme-space-3);
      padding: var(--acme-space-3) 0;
      border-top: 1px solid var(--app-hairline);
    }
    .project-row { grid-template-columns: 56px minmax(0, 1fr) auto; }
    .time-row { grid-template-columns: minmax(0, 1fr) auto; }

    .thumb {
      position: relative;
      width: 56px;
      height: 40px;
      border-radius: var(--acme-radius-sm);
      overflow: hidden;
      background: var(--acme-color-surface);
    }
    .thumb img { object-fit: cover; }

    .p-body, .t-body { display: grid; min-width: 0; }
    .p-body a { font-weight: 600; text-decoration: none; }
    .p-body .muted {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .t-body strong { font-size: var(--acme-text-sm); }

    .learning-row {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(7rem, 1fr) 6.5rem;
      align-items: center;
      gap: var(--acme-space-2) var(--acme-space-5);
      padding: var(--acme-space-3) 0;
      border-top: 1px solid var(--app-hairline);
    }
    .l-body { display: grid; min-width: 0; }
    .l-body a { font-weight: 600; text-decoration: none; }
    .learning-row .badge { justify-self: start; }
    .reports a { white-space: nowrap; }
    .private-note { margin: calc(-1 * var(--acme-space-2)) 0 var(--acme-space-4); }

    @media (max-width: 560px) {
      .learning-row { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, AvatarComponent, ProgressMeterComponent],
})
export class EmployeeDetailsComponent implements OnInit {
  private readonly person = signal<Employee | undefined>(undefined);
  private initialized = false;
  private loading?: Subscription;

  /**
   * Route data. Moving from one profile to another (say, from "Reports to")
   * reuses this component, so every new person triggers a fresh load.
   */
  @Input() set employee(value: Employee) {
    const previous = this.person();
    this.person.set(value);
    if (this.initialized && value.id !== previous?.id) {
      this.loaded.set(false);
      this.load();
    }
  }
  get employee(): Employee {
    return this.person()!;
  }

  private readonly projectService = inject(ProjectService);
  private readonly employeeService = inject(EmployeeService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);

  private readonly permissions = inject(PermissionsService);
  private readonly user = inject(AuthService).currentUser;

  formatRange = formatRange;
  tone = enrollmentTone;
  courseStatus = enrollmentLabel;
  longDate = formatLongDate;
  tenure = (startDate: string) => tenure(startDate);

  canEdit = this.permissions.can('EditEmployeeGeneralDetails');
  canApprove = this.permissions.can('ApproveTimeOff');
  private readonly canSeeAllPrivate = this.permissions.can('EditEmployeePrivateDetails');
  /** Private details are for HR and for the person themselves. */
  isSelf = computed(() => this.user()?.employeeId === this.employee?.id);
  canSeePrivate = computed(() => this.canSeeAllPrivate() || this.isSelf());

  projects = signal<Project[]>([]);
  loaded = signal(false);
  busy = signal(false);

  private readonly requests = signal<TimeOffRequest[]>([]);
  private readonly colleagues = signal<Employee[]>([]);
  /** This person's courses, overdue first, then unfinished, then completed. */
  training = signal<{ enrollment: Enrollment; title: string }[]>([]);
  completedTraining = computed(
    () => this.training().filter((item) => item.enrollment.status === 'Completed').length,
  );
  private readonly away = signal<Record<number, string>>({});

  get fullName(): string {
    return `${this.employee.firstName} ${this.employee.lastName}`;
  }

  /** This person's requests, newest first. */
  history = computed(() =>
    this.requests()
      .filter((request) => request.employeeId === this.employee.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
  );

  pending = computed(() => this.history().find((request) => request.status === 'Pending'));

  manager = computed(() => this.colleagues().find((person) => person.id === this.employee.managerId));
  /** Who reports to this person, by name. */
  reports = computed(() =>
    this.colleagues()
      .filter((person) => person.managerId === this.employee.id)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
  );

  /** Cover impact for the pending request, so it is decidable right here. */
  impact = computed(() => {
    const request = this.pending();
    return request ? clashInfo(request, this.requests(), this.colleagues()).text : '';
  });

  ngOnInit() {
    this.initialized = true;
    this.load();
  }

  private load() {
    this.loading?.unsubscribe();
    this.loading = forkJoin({
      projects: this.projectService.getProjectsByEmployeeId(this.employee.id),
      employees: this.employeeService.getEmployees(),
      requests: this.timeOffRequestService.getRequests(),
      enrollments: this.enrollmentService.getEnrollmentsByEmployee(this.employee.id),
      courses: this.courseService.getCourses(),
    }).subscribe(({ projects, employees, requests, enrollments, courses }) => {
      this.projects.set(projects);
      this.colleagues.set(employees);
      this.requests.set(requests);
      this.away.set(awayLabels(requests));

      const titles = new Map(courses.map((course) => [course.id, course.title]));
      // Overdue first: that is the row somebody has to act on.
      const rank = (enrollment: Enrollment) =>
        isOverdue(enrollment) ? 0 : enrollment.status === 'Completed' ? 2 : 1;
      this.training.set(
        enrollments
          .map((enrollment) => ({
            enrollment,
            title: titles.get(enrollment.courseId) ?? `Course #${enrollment.courseId}`,
          }))
          .sort((a, b) => rank(a.enrollment) - rank(b.enrollment)),
      );

      this.loaded.set(true);
    });
  }

  statusLabel(): string {
    return this.employee.isAvailable ? 'In today' : (this.away()[this.employee.id] ?? 'Away');
  }

  /** "Completed 3 Oct", "Due 20 Oct", or "No due date". */
  dueLabel(enrollment: Enrollment): string {
    if (enrollment.status === 'Completed') {
      return enrollment.completedAt ? `Completed ${formatDay(enrollment.completedAt)}` : 'Completed';
    }
    return enrollment.dueDate ? `Due ${formatDay(enrollment.dueDate)}` : 'No due date';
  }

  days(request: TimeOffRequest): string {
    const count = dayCount(request);
    return `${count} ${count === 1 ? 'day' : 'days'}`;
  }

  resolve(request: TimeOffRequest, status: 'Approved' | 'Rejected') {
    this.busy.set(true);
    const action = status === 'Approved'
      ? this.timeOffRequestService.approveRequest(request.id)
      : this.timeOffRequestService.rejectRequest(request.id);
    action.subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }
}
