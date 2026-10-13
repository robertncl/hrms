import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, numberAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, map, shareReplay, switchMap } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { Project } from 'src/app/infrastructure/types/project';
import { EmployeeService } from 'src/app/services/employee.service';
import { ProjectService } from 'src/app/services/project.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { ProjectCardComponent } from 'src/app/shared/components/project-card.component';

@Component({
  selector: 'app-project-details',
  template: `
    <div class="project-details page">
      <a class="back-link" routerLink="/work/projects"><app-icon name="arrow-left" [size]="16" /> Projects</a>
      @if (project$ | async; as project) {
        <section class="card hero">
          @if (project.image) {
            <div class="media">
              <img [ngSrc]="project.image" [loaderParams]="{ src: project.image }" fill disableOptimizedSrcset priority alt="" />
            </div>
          }
          <div class="hero-body">
            <h1>{{ project.name }}</h1>
            <p>{{ project.description }}</p>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Team</h2>
            <span class="muted small">{{ project.employees.length }} members</span>
          </div>
          @if (team$ | async; as team) {
            <ul class="team">
              @for (member of team; track member.id) {
                <li>
                  <app-avatar [name]="member.firstName + ' ' + member.lastName" [src]="member.profilePicture" />
                  <div>
                    <a [routerLink]="['/employees/details', member.id]">{{ member.firstName }} {{ member.lastName }}</a>
                    <span class="muted small">{{ member.position }} · {{ member.level }}</span>
                  </div>
                </li>
              } @empty {
                <li class="muted">Nobody is assigned yet.</li>
              }
            </ul>
          }
        </section>

        @if (project.subProjectIds.length) {
          <section class="subprojects">
            <h2>Subprojects</h2>
            <div class="row">
              @for (subProjectId of project.subProjectIds; track subProjectId) {
                <app-project-card [projectId]="subProjectId"></app-project-card>
              }
            </div>
          </section>
        }
      } @else {
        <p class="loading">Loading project…</p>
      }
    </div>
    `,
  styles: `
    .hero { padding: 0; overflow: hidden; }
    .media { position: relative; aspect-ratio: 21 / 7; background: var(--surface-2); }
    .media img { object-fit: cover; }
    .hero-body { display: grid; gap: 0.5rem; padding: 1.25rem; }
    .hero-body p { color: var(--text-secondary); max-width: 70ch; }
    .team {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.85rem 1.5rem;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    }
    .team li { display: flex; align-items: center; gap: 0.65rem; }
    .team li div { display: grid; }
    .team a { font-weight: 600; text-decoration: none; }
    .subprojects { display: grid; gap: 0.75rem; }
    .row {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    }
  `,
  standalone: true,
  imports: [AsyncPipe, NgOptimizedImage, RouterLink, ProjectCardComponent, AvatarComponent, IconComponent],
})
export class ProjectDetailsComponent implements OnChanges {
  @Input({transform: numberAttribute}) id!: number;
  private readonly projectService = inject(ProjectService);
  private readonly employeeService = inject(EmployeeService);
  project$: Observable<Project> | null = null;
  team$: Observable<Employee[]> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['id']) {
      const project$ = this.projectService.getProject(this.id).pipe(shareReplay(1));
      this.project$ = project$;
      this.team$ = project$.pipe(
        switchMap((project) =>
          this.employeeService.getEmployees().pipe(
            map((employees) => employees.filter((e) => project.employees.includes(e.id))),
          ),
        ),
      );
    }
  }
}
