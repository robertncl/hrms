import { NgOptimizedImage } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, computed, inject, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EmployeeService } from 'src/app/services/employee.service';
import { ProjectService } from 'src/app/services/project.service';
import { TimeOffRequestService } from 'src/app/services/time-off-request.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { awayLabels } from 'src/app/pages/employees/people-table';
import { StaffedProject, projectStaffing } from './project-staffing';

@Component({
  selector: 'app-project-details',
  template: `
    <div class="page bleed">
      @if (project(); as project) {
        <header class="hero">
          @if (project.image) {
            <img [ngSrc]="project.image" [loaderParams]="{ src: project.image }" fill
              disableOptimizedSrcset priority alt="" />
          }
          <div class="hero-body">
            <nav class="crumbs" aria-label="Breadcrumb">
              <a routerLink="/work/projects">Projects</a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{{ project.name }}</span>
            </nav>
            <h1>{{ project.name }}</h1>
            @if (project.description) {
              <p>{{ project.description }}</p>
            }
          </div>
        </header>

        <div class="hero-under split">
          <section class="card flush" aria-labelledby="team-title">
            <div class="card-header">
              <h2 id="team-title">Team · {{ project.team.length }}</h2>
            </div>
            @if (project.team.length) {
              <div class="rows">
                @for (member of project.team; track member.id) {
                  <div class="row-item member">
                    <app-avatar [name]="member.name" [away]="member.away" />
                    <a [routerLink]="['/employees/details', member.id]">{{ member.name }}</a>
                    <span class="muted small">{{ member.role }}</span>
                    <span class="status" [class.is-away]="member.away">{{ statusLabel(member) }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="empty-state">Nobody is assigned yet.</p>
            }
          </section>

          <div class="stack">
            @if (project.awayCount) {
              <section class="callout callout-danger" aria-labelledby="cover-title">
                <div class="callout-body">
                  <strong id="cover-title">
                    {{ project.awayCount }} of {{ project.team.length }} away right now
                  </strong>
                  <span>{{ coverNote() }}</span>
                </div>
              </section>
            }

            <section class="card" aria-labelledby="sub-title">
              <h2 id="sub-title">Sub-projects</h2>
              @if (subProjects().length) {
                <ul class="sub-list">
                  @for (sub of subProjects(); track sub.id) {
                    <li>
                      <a [routerLink]="['/work/projects', sub.id]">{{ sub.name }}</a>
                      <span class="muted small">{{ sub.staffing }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="muted small">None yet. A workstream becomes one when it gets its own team.</p>
              }
            </section>
          </div>
        </div>
      } @else {
        <p class="loading page">Loading project…</p>
      }
    </div>
    `,
  styles: `
    .hero {
      position: relative;
      height: 260px;
      overflow: hidden;
      color: var(--acme-gray-0);
    }
    .hero img { object-fit: cover; }
    /* A navy scrim so the title clears contrast over any photograph. */
    .hero::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgb(10 17 30 / 0.1), rgb(10 17 30 / 0.72));
    }
    .hero-body {
      position: absolute;
      inset-inline: var(--acme-space-12);
      bottom: var(--acme-space-6);
      z-index: 1;
      max-width: 60ch;
    }
    .hero-body h1 { margin: 0; font-size: var(--acme-text-4xl); }
    .hero-body p { margin-top: var(--acme-space-2); font-size: var(--acme-text-md); }

    .crumbs {
      display: flex;
      align-items: center;
      gap: var(--acme-space-2);
      margin-bottom: var(--acme-space-2);
      font-size: var(--acme-text-sm);
      opacity: 0.9;
    }
    .crumbs a { color: inherit; text-decoration: none; }
    .crumbs a:hover { text-decoration: underline; }

    .hero-under { padding: var(--acme-space-8) var(--acme-space-12); }

    .member { grid-template-columns: 32px minmax(0, 1fr) 140px 180px; }
    .member a { color: var(--acme-color-text); font-weight: 600; text-decoration: none; }
    .member a:hover { color: var(--acme-color-link); text-decoration: underline; }

    .sub-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--acme-space-3); }
    .sub-list li {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--acme-space-3);
    }
    .sub-list a { font-weight: 600; text-decoration: none; }

    @media (max-width: 1100px) {
      .member { grid-template-columns: 32px minmax(0, 1fr) auto; }
      .member .status { grid-column: 2 / -1; }
    }

    @media (max-width: 860px) {
      .hero { height: 200px; }
      .hero-body { inset-inline: var(--acme-space-5); }
      .hero-under { padding: var(--acme-space-6) var(--acme-space-5); }
    }
  `,
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, AvatarComponent],
})
export class ProjectDetailsComponent implements OnChanges {
  @Input({ transform: numberAttribute }) id!: number;

  private readonly projectService = inject(ProjectService);
  private readonly employeeService = inject(EmployeeService);
  private readonly timeOffRequestService = inject(TimeOffRequestService);

  project = signal<StaffedProject | null>(null);
  private readonly all = signal<StaffedProject[]>([]);
  private readonly away = signal<Record<number, string>>({});

  subProjects = computed(() => {
    const ids = new Set(this.project()?.subProjectIds ?? []);
    return this.all().filter((project) => ids.has(project.id));
  });

  /** Names and return dates for whoever is out, so the warning is actionable. */
  coverNote = computed(() => {
    const team = this.project()?.team ?? [];
    const absent = team.filter((member) => member.away);
    if (!absent.length) return '';
    const parts = absent.map((member) => {
      const detail = this.away()[member.id];
      if (!detail) return `${member.name.split(' ')[0]} is away`;
      // "Vacation until 20 Oct" -> "on vacation until 20 Oct": only the leave
      // type lowercases, never the date.
      const [type, date] = detail.split(' until ');
      const phrase = date ? `${type.toLowerCase()} until ${date}` : type.toLowerCase();
      return `${member.name.split(' ')[0]} is on ${phrase}`;
    });
    return `${parts.join('. ')}.`;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['id']) return;
    forkJoin({
      projects: this.projectService.getProjects(),
      employees: this.employeeService.getEmployees(),
      requests: this.timeOffRequestService.getRequests(),
    }).subscribe(({ projects, employees, requests }) => {
      const staffed = projects.map((project) => projectStaffing(project, projects, employees));
      this.all.set(staffed);
      this.project.set(staffed.find((project) => project.id === this.id) ?? null);
      this.away.set(awayLabels(requests));
    });
  }

  statusLabel(member: { id: number; away: boolean }): string {
    return member.away ? (this.away()[member.id] ?? 'Away') : 'In today';
  }
}
