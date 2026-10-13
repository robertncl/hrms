import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Project } from 'src/app/infrastructure/types/project';
import { ProjectService } from 'src/app/services/project.service';

@Component({
    selector: 'app-project-card',
    template: `
        @if (project$ | async; as project) {
          <article class="card">
            <div class="media">
              @if (project.image) {
                <img [ngSrc]="project.image" [loaderParams]="{ src: project.image }" fill disableOptimizedSrcset alt="" />
              }
            </div>
            <div class="card-body">
              <a [routerLink]="['/work/projects', project.id]">{{ project.name }}</a>
              @if (project.description) {
                <p class="description">{{ project.description }}</p>
              }
              <span class="tag">{{ project.employees.length }} {{ project.employees.length === 1 ? 'member' : 'members' }}</span>
            </div>
          </article>
        }
        `,
    styles: `
      :host { display: block; height: 100%; }
      .card {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0;
        overflow: hidden;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        transition: border-color 120ms, transform 120ms;
      }
      .card:hover { border-color: var(--border-strong); transform: translateY(-1px); }
      .media {
        position: relative;
        aspect-ratio: 16 / 9;
        background: var(--surface-2);
      }
      .media img { object-fit: cover; }
      .card-body {
        display: grid;
        gap: 0.4rem;
        justify-items: start;
        padding: 0.9rem 1rem 1rem;
      }
      a {
        color: var(--text);
        font-weight: 600;
        text-decoration: none;
      }
      /* Whole card is clickable through the title link. */
      a::after { content: ''; position: absolute; inset: 0; }
      a:focus-visible { outline: none; }
      .card:has(a:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
      .description {
        color: var(--text-secondary);
        font-size: 0.88rem;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
      }
    `,
    imports: [AsyncPipe, RouterLink, NgOptimizedImage],
    standalone: true,
})
export class ProjectCardComponent implements OnChanges {
    private readonly projectService = inject(ProjectService);
    @Input({required: true}) projectId!: number;
    project$: Observable<Project> | null = null;
    ngOnChanges(changes: SimpleChanges): void {
        if (changes['projectId']) {
            this.project$ = this.projectService.getProject(this.projectId);
        }
    }
}
