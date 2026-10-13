import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ProjectService } from 'src/app/services/project.service';
import { ProjectCardComponent } from 'src/app/shared/components/project-card.component';

@Component({
    selector: 'app-project-list',
    template: `
        <div class="page">
          <div class="page-header">
            <div>
              <h1>Projects</h1>
              <p>What each team is working on.</p>
            </div>
          </div>
          @if (projects$ | async; as projects) {
            <div class="row">
              @for (project of projects; track project.id) {
                <app-project-card [projectId]="project.id"/>
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
      .row {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
      }
    `,
    standalone: true,
    imports: [ProjectCardComponent, AsyncPipe],
})
export class ProjectListComponent {
    private readonly projectService = inject(ProjectService);
    projects$ = this.projectService.getProjects();
}
