import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { EmployeeService } from 'src/app/services/employee.service';
import { ProjectService } from 'src/app/services/project.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { projectStaffing } from './project-staffing';

@Component({
  selector: 'app-project-list',
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Projects</h1>
          <p>{{ summary() }}</p>
        </div>
      </div>

      @if (loaded()) {
        <div class="project-grid">
          @for (project of projects(); track project.id) {
            <article class="card flush project">
              @if (project.image) {
                <div class="media">
                  <img [ngSrc]="project.image" [loaderParams]="{ src: project.image }" fill
                    disableOptimizedSrcset alt="" />
                </div>
              }
              <div class="body">
                <div class="head">
                  <h2>
                    <a [routerLink]="['/work/projects', project.id]">{{ project.name }}</a>
                  </h2>
                  @if (project.awayCount) {
                    <span class="badge badge-critical">{{ project.awayCount }} away</span>
                  }
                </div>
                @if (project.description) {
                  <p class="description">{{ project.description }}</p>
                }
                <div class="foot">
                  <div class="avatar-stack">
                    @for (member of project.team; track member.id) {
                      <app-avatar [name]="member.name" [away]="member.away" size="1.75rem" />
                    }
                  </div>
                  <span class="small muted">{{ project.staffing }}</span>
                </div>
                @if (project.subProjectNames.length) {
                  <div class="sub">
                    {{ project.subProjectNames.length === 1 ? 'Sub-project' : 'Sub-projects' }} ·
                    {{ project.subProjectNames.join(', ') }}
                  </div>
                }
              </div>
            </article>
          } @empty {
            <p class="empty-state">No projects yet.</p>
          }
        </div>
      } @else {
        <p class="loading">Loading projects…</p>
      }
    </div>
    `,
  styles: `
    .project-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--acme-space-6);
    }

    .project {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
    }

    .media { position: relative; min-height: 220px; background: var(--acme-color-surface); }
    .media img { object-fit: cover; }

    .body {
      display: grid;
      gap: var(--acme-space-3);
      align-content: start;
      padding: var(--acme-space-5) var(--acme-space-6);
    }

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--acme-space-2);
    }
    .head h2 { margin: 0; font-size: var(--acme-text-xl); }
    .head a { color: inherit; text-decoration: none; }
    .head a:hover { color: var(--acme-color-link); }

    .description {
      font-size: var(--acme-text-sm);
      line-height: var(--acme-leading-snug);
      color: var(--acme-color-text-muted);
    }

    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--acme-space-3);
      margin-top: var(--acme-space-1);
    }

    .sub {
      padding-top: var(--acme-space-3);
      border-top: 1px solid var(--app-hairline);
      font-size: var(--acme-text-sm);
      color: var(--acme-color-text-muted);
    }

    @media (max-width: 1100px) {
      .project-grid { grid-template-columns: minmax(0, 1fr); }
    }

    @media (max-width: 640px) {
      .project { grid-template-columns: minmax(0, 1fr); }
      .media { min-height: 0; aspect-ratio: 16 / 9; }
    }
  `,
  standalone: true,
  imports: [NgOptimizedImage, RouterLink, AvatarComponent],
})
export class ProjectListComponent {
  private readonly projectService = inject(ProjectService);
  private readonly employeeService = inject(EmployeeService);

  private readonly result = toSignal(
    forkJoin({
      projects: this.projectService.getProjects(),
      employees: this.employeeService.getEmployees(),
    }),
  );

  loaded = computed(() => this.result() !== undefined);

  /** Top-level projects only: a sub-project is listed under its parent. */
  projects = computed(() => {
    const data = this.result();
    if (!data) return [];
    const subProjectIds = new Set(data.projects.flatMap((project) => project.subProjectIds));
    return data.projects
      .filter((project) => !subProjectIds.has(project.id))
      .map((project) => projectStaffing(project, data.projects, data.employees));
  });

  summary = computed(() => {
    const projects = this.projects();
    if (!projects.length) return 'No projects yet.';
    const subs = projects.reduce((total, project) => total + project.subProjectNames.length, 0);
    const main = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`;
    return subs
      ? `${main}, ${subs} ${subs === 1 ? 'sub-project' : 'sub-projects'}. Staffing at a glance.`
      : `${main}. Staffing at a glance.`;
  });
}
