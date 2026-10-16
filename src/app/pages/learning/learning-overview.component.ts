import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { Course, Enrollment } from 'src/app/infrastructure/types/course';
import { CourseService } from 'src/app/services/course.service';
import { EnrollmentService } from 'src/app/services/enrollment.service';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { AuthService } from 'src/app/services/auth.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { BarListComponent, BarListItem } from 'src/app/shared/components/bar-list.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { ProgressMeterComponent } from 'src/app/shared/components/progress-meter.component';
import { COURSE_CATEGORIES, completionRate, formatDuration, isOverdue } from './learning';

@Component({
  selector: 'app-learning-overview',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Learning</h1>
          <p>Courses, assignments and compliance training.</p>
        </div>
        @if (canManage()) {
          <div class="page-actions">
            <a class="btn btn-primary" routerLink="/learning/courses/new"><app-icon name="plus" /> New course</a>
          </div>
        }
      </div>

      @if (data.hasValue()) {
        <section class="stats" aria-label="Learning figures">
          <div class="card stat">
            <span class="stat-label">Active assignments</span>
            <span class="stat-value">{{ activeCount() }}</span>
            <span class="stat-note">Not yet completed</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Completion rate</span>
            <span class="stat-value">{{ overallRate() }}%</span>
            <span class="stat-note">Of all assigned training</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Overdue</span>
            <span class="stat-value">{{ overdue().length }}</span>
            <span class="stat-note">Past their due date</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Mandatory training</span>
            <span class="stat-value">{{ mandatoryRate() }}%</span>
            <span class="stat-note">Complete across the company</span>
          </div>
        </section>

        <div class="panels">
          <section class="card">
            <div class="card-header">
              <h2>{{ canAssign() ? 'Overdue training' : 'Your overdue training' }}</h2>
              <span class="muted small">{{ overdueList().length }} assignments</span>
            </div>
            @if (overdueList().length) {
              <ul class="list">
                @for (enrollment of overdueList().slice(0, 6); track enrollment.id) {
                  <li>
                    <app-avatar [name]="employeeName(enrollment.employeeId)" size="2rem" />
                    <div class="grow">
                      <a [routerLink]="['/employees/details', enrollment.employeeId]">{{ employeeName(enrollment.employeeId) }}</a>
                      <a class="muted small" [routerLink]="['/learning/courses', enrollment.courseId]">{{ courseTitle(enrollment.courseId) }}</a>
                    </div>
                    <span class="badge badge-critical">Due {{ enrollment.dueDate | date: 'MMM d' }}</span>
                  </li>
                }
              </ul>
            } @else {
              <p class="empty-state">{{ canAssign() ? 'Nothing overdue. Everyone is on track.' : 'Nothing overdue. You are on track.' }}</p>
            }
          </section>

          <section class="card">
            <div class="card-header">
              <h2>Completion by course</h2>
              <span class="muted small">Share of assignments completed</span>
            </div>
            <app-bar-list [items]="completionByCourse()" unit="%" [scaleMax]="100" label="Completion by course" />
          </section>
        </div>

        <section class="catalog" aria-labelledby="catalog-title">
          <div class="catalog-header">
            <h2 id="catalog-title">Course catalog</h2>
            <div class="toolbar" role="search">
              <label class="visually-hidden" for="course-search">Search courses</label>
              <input id="course-search" class="input" type="search" placeholder="Search courses"
                [value]="search()" (input)="search.set($any($event.target).value)" />
              <label class="visually-hidden" for="course-category">Category</label>
              <select id="course-category" class="input" [value]="categoryFilter()"
                (change)="categoryFilter.set($any($event.target).value)">
                <option value="">All categories</option>
                @for (category of categories; track category) {
                  <option [value]="category">{{ category }}</option>
                }
              </select>
            </div>
          </div>
          <div class="courses">
            @for (course of filteredCourses(); track course.id) {
              <article class="card course">
                <div class="course-tags">
                  <span class="tag">{{ course.category }}</span>
                  @if (course.mandatory) {
                    <span class="badge badge-info">Mandatory</span>
                  }
                </div>
                <h3><a [routerLink]="['/learning/courses', course.id]">{{ course.title }}</a></h3>
                <p class="muted small">{{ course.format }} · {{ duration(course) }} · {{ course.modules.length }} modules</p>
                <p class="description">{{ course.description }}</p>
                <div class="course-foot">
                  <span class="muted small">{{ enrollmentsFor(course.id).length }} enrolled</span>
                  <app-progress-meter [value]="rateFor(course.id)" [label]="course.title + ' completion'" />
                </div>
              </article>
            } @empty {
              <p class="empty-state">No courses match your search.</p>
            }
          </div>
        </section>
      } @else if (data.error()) {
        <p class="alert alert-error" role="alert">Learning data could not be loaded. Please try again.</p>
      } @else {
        <p class="loading">Loading learning…</p>
      }
    </div>
  `,
  styles: `
    .stats {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
    }
    .stat { display: grid; gap: 0.15rem; }
    .stat-label { font-size: 0.9rem; color: var(--acme-color-text-muted); }
    .stat-value { font-size: 2rem; font-weight: 650; line-height: 1.2; }
    .stat-note { font-size: 0.82rem; color: var(--acme-color-text-subtle); }
    .panels {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
      align-items: start;
    }
    .list { list-style: none; margin: 0; padding: 0; display: grid; }
    .list li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--acme-color-border);
    }
    .list li:last-child { border-bottom: 0; }
    .grow { flex: 1; display: grid; min-width: 0; }
    .grow a:first-child { font-weight: 600; text-decoration: none; }
    .grow a.muted { text-decoration: none; }
    .grow a.muted:hover { text-decoration: underline; }
    .catalog { display: grid; gap: 1rem; }
    .catalog-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .catalog-header .toolbar { flex: 1 1 24rem; justify-content: flex-end; }
    .courses {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    }
    .course {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      transition: border-color 120ms;
    }
    .course:hover { border-color: var(--acme-color-border-strong); }
    .course-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
    .course h3 a { color: var(--acme-color-text); text-decoration: none; }
    /* Whole card is clickable through the title link. */
    .course h3 a::after { content: ''; position: absolute; inset: 0; }
    .course h3 a:focus-visible { outline: none; }
    .course:has(h3 a:focus-visible) { outline: 2px solid var(--acme-color-focus); outline-offset: 2px; }
    .description {
      color: var(--acme-color-text-muted);
      font-size: 0.88rem;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
    }
    .course-foot {
      margin-top: auto;
      padding-top: 0.5rem;
      display: grid;
      gap: 0.3rem;
    }
  `,
  imports: [DatePipe, RouterLink, AvatarComponent, BarListComponent, IconComponent, ProgressMeterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningOverviewComponent {
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly employeeService = inject(EmployeeService);
  private readonly user = inject(AuthService).currentUser;

  readonly categories = COURSE_CATEGORIES;
  readonly duration = formatDuration;
  canManage = toSignal(inject(PermissionsService).hasPermission('ManageCourses'), { initialValue: false });
  canAssign = inject(PermissionsService).can('AssignTraining');
  private readonly ownId = computed(() => this.user()?.employeeId);

  /** Bound from the `?category=` query parameter. */
  category = input<string>('');
  categoryFilter = linkedSignal(() => this.category() ?? '');
  search = signal('');

  data = rxResource({
    stream: () =>
      forkJoin({
        courses: this.courseService.getCourses(),
        enrollments: this.enrollmentService.getEnrollments(),
        employees: this.employeeService.getEmployees(),
      }),
  });

  private readonly courses = computed(() => (this.data.hasValue() ? this.data.value().courses : []));
  private readonly enrollments = computed(() => (this.data.hasValue() ? this.data.value().enrollments : []));
  private readonly employeeNames = computed(
    () => new Map((this.data.hasValue() ? this.data.value().employees : []).map((e) => [e.id, `${e.firstName} ${e.lastName}`])),
  );
  private readonly enrollmentsByCourse = computed(() => {
    const byCourse = new Map<number, Enrollment[]>();
    for (const enrollment of this.enrollments()) {
      byCourse.set(enrollment.courseId, [...(byCourse.get(enrollment.courseId) ?? []), enrollment]);
    }
    return byCourse;
  });

  activeCount = computed(() => this.enrollments().filter((e) => e.status !== 'Completed').length);
  overallRate = computed(() => completionRate(this.enrollments()));
  overdue = computed(() =>
    this.enrollments()
      .filter((e) => isOverdue(e))
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
  );
  /** The list people act on: everyone's for those who assign training, your own otherwise. */
  overdueList = computed(() =>
    this.canAssign() ? this.overdue() : this.overdue().filter((e) => e.employeeId === this.ownId()),
  );
  mandatoryRate = computed(() => {
    const mandatory = new Set(this.courses().filter((c) => c.mandatory).map((c) => c.id));
    return completionRate(this.enrollments().filter((e) => mandatory.has(e.courseId)));
  });

  completionByCourse = computed<BarListItem[]>(() =>
    this.courses()
      .filter((course) => this.enrollmentsFor(course.id).length)
      .map((course) => ({
        label: course.title,
        value: this.rateFor(course.id),
        link: ['/learning/courses', course.id],
      })),
  );

  filteredCourses = computed(() => {
    const term = this.search().trim().toLowerCase();
    const category = this.categoryFilter();
    return this.courses().filter(
      (course: Course) =>
        (!category || course.category === category) &&
        (!term || `${course.title} ${course.description}`.toLowerCase().includes(term)),
    );
  });

  enrollmentsFor(courseId: number): Enrollment[] {
    return this.enrollmentsByCourse().get(courseId) ?? [];
  }

  rateFor(courseId: number): number {
    return completionRate(this.enrollmentsFor(courseId));
  }

  employeeName(id: number): string {
    return this.employeeNames().get(id) ?? `Employee #${id}`;
  }

  courseTitle(id: number): string {
    return this.courses().find((c) => c.id === id)?.title ?? `Course #${id}`;
  }
}
