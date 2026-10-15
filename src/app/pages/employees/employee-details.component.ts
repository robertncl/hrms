import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { Project } from 'src/app/infrastructure/types/project';
import { ProjectService } from 'src/app/services/project.service';
import { CourseService } from 'src/app/services/course.service';
import { EnrollmentService } from 'src/app/services/enrollment.service';
import { ProgressMeterComponent } from 'src/app/shared/components/progress-meter.component';
import { enrollmentLabel, enrollmentTone, isOverdue } from '../learning/learning';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { ProjectCardComponent } from 'src/app/shared/components/project-card.component';

@Component({
  selector: 'app-employee-details',
  template: `
    <div class="page">
      <div>
        <a class="back-link" routerLink="/employees"><app-icon name="arrow-left" [size]="16" /> Employees</a>
        <div class="page-header">
          <div class="profile">
            <app-avatar [name]="employee.firstName + ' ' + employee.lastName" [src]="employee.profilePicture" size="4rem" />
            <div>
              <h1>{{ employee.firstName }} {{ employee.lastName }}</h1>
              <p>{{ employee.position }} · {{ employee.level }}</p>
            </div>
          </div>
          <div class="page-actions">
            <a class="btn" [href]="'mailto:' + employee.email">Email</a>
            <a class="btn btn-primary" [routerLink]="['/employees/edit', employee.id]">Edit</a>
          </div>
        </div>
      </div>

      <div class="layout">
        <section class="card">
          <h2>Details</h2>
          <dl class="details-list">
            <dt>First Name</dt><dd>{{ employee.firstName }}</dd>
            <dt>Last Name</dt><dd>{{ employee.lastName }}</dd>
            <dt>Email</dt><dd>{{ employee.email }}</dd>
            <dt>Position</dt><dd>{{ employee.position }}</dd>
            <dt>Level</dt><dd>{{ employee.level }}</dd>
            <dt>Status</dt>
            <dd>
              @if (employee.isAvailable) {
                <span class="badge badge-good">Available</span>
              } @else {
                <span class="badge badge-serious">On leave</span>
              }
            </dd>
          </dl>
        </section>

        <section class="card projects">
          <h2>Projects</h2>
          @if (projects$ | async; as projects) {
            <div class="project-grid">
              @for (project of projects; track project.id) {
                <div class="project">
                  <app-project-card [projectId]="project.id"></app-project-card>
                </div>
              } @empty {
                <p class="empty-state">Not assigned to any project yet.</p>
              }
            </div>
          } @else {
            <p class="loading">Loading projects…</p>
          }
        </section>
      </div>

      <section class="card training">
        <div class="card-header">
          <h2>Training</h2>
          @if (training().length) {
            <span class="muted small">{{ completedTraining() }} of {{ training().length }} complete</span>
          }
        </div>
        @if (trainingData.hasValue()) {
          <ul class="training-list">
            @for (item of training(); track item.enrollment.id) {
              <li>
                <div class="training-course">
                  <a [routerLink]="['/learning/courses', item.enrollment.courseId]">{{ item.title }}</a>
                  <span class="muted small">
                    @if (item.enrollment.status === 'Completed') {
                      Completed {{ item.enrollment.completedAt | date: 'MMM d, y' }}
                    } @else if (item.enrollment.dueDate) {
                      Due {{ item.enrollment.dueDate | date: 'MMM d, y' }}
                    } @else {
                      No due date
                    }
                  </span>
                </div>
                <app-progress-meter [value]="item.enrollment.progress" [label]="item.title + ' progress'" />
                <span [class]="'badge badge-' + tone(item.enrollment)">{{ statusLabel(item.enrollment) }}</span>
              </li>
            } @empty {
              <li class="muted">No training assigned.</li>
            }
          </ul>
        } @else if (trainingData.isLoading()) {
          <p class="loading">Loading training…</p>
        }
      </section>
    </div>
    `,
  styles: `
    .profile { display: flex; align-items: center; gap: 1rem; }
    .layout {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      align-items: start;
    }
    .project-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
    }
    .training-list { list-style: none; margin: 0; padding: 0; display: grid; }
    .training-list li {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(8rem, 1fr) 7.5rem;
      align-items: center;
      gap: 0.5rem 1.25rem;
      padding: 0.65rem 0;
      border-bottom: 1px solid var(--border);
    }
    .training-list li:last-child { border-bottom: 0; }
    .training-course { display: grid; }
    .training-course a { font-weight: 600; text-decoration: none; }
    .training-list .badge { justify-self: start; }
    @media (max-width: 860px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 560px) {
      .training-list li { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, ProjectCardComponent, AvatarComponent, IconComponent, ProgressMeterComponent],
})
export class EmployeeDetailsComponent implements OnInit {
  projectService = inject(ProjectService);
  @Input() employee!: Employee;
  projects$: Observable<Project[]> | null = null;
  private readonly courseService = inject(CourseService);
  private readonly enrollmentService = inject(EnrollmentService);
  readonly tone = enrollmentTone;
  readonly statusLabel = enrollmentLabel;

  // Loads once the employee input is set (the first change detection pass).
  trainingData = rxResource({
    stream: () =>
      forkJoin({
        enrollments: this.enrollmentService.getEnrollmentsByEmployee(this.employee.id),
        courses: this.courseService.getCourses(),
      }),
  });

  /** Overdue first, then unfinished, then completed. */
  training = computed(() => {
    if (!this.trainingData.hasValue()) return [];
    const { enrollments, courses } = this.trainingData.value();
    const titles = new Map(courses.map((c) => [c.id, c.title]));
    const rank = (status: string, overdue: boolean) => (overdue ? 0 : status === 'Completed' ? 2 : 1);
    return enrollments
      .map((enrollment) => ({ enrollment, title: titles.get(enrollment.courseId) ?? `Course #${enrollment.courseId}` }))
      .sort((a, b) => rank(a.enrollment.status, isOverdue(a.enrollment)) - rank(b.enrollment.status, isOverdue(b.enrollment)));
  });
  completedTraining = computed(() => this.training().filter((t) => t.enrollment.status === 'Completed').length);

  ngOnInit() {
    this.projects$ = this.projectService.getProjectsByEmployeeId(this.employee.id);
  }
}
