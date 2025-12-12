import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Project } from 'src/app/infrastructure/types/project';
import { ProjectService } from 'src/app/services/project.service';
import { FileUploadComponent } from 'src/app/shared/components/file-upload.component';
import { ProjectCardComponent } from 'src/app/shared/components/project-card.component';

@Component({
    selector: 'app-project-list',
    template: `
        <div class="row">
          @for (project of projects$ | async; track project) {
            <app-project-card [projectId]="project.id"/>
          }
        </div>
        `,
    standalone: true,
    imports: [ProjectCardComponent, AsyncPipe],
})
export class ProjectListComponent {
    private readonly projectService = inject(ProjectService);
    projects$ = this.projectService.getProjects();
}