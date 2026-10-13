import { AsyncPipe } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { Project } from 'src/app/infrastructure/types/project';
import { ProjectService } from 'src/app/services/project.service';
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
    @media (max-width: 860px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  standalone: true,
  imports: [AsyncPipe, RouterLink, ProjectCardComponent, AvatarComponent, IconComponent],
})
export class EmployeeDetailsComponent implements OnInit {
  projectService = inject(ProjectService);
  @Input() employee!: Employee;
  projects$: Observable<Project[]> | null = null;
  ngOnInit() {
    this.projects$ = this.projectService.getProjectsByEmployeeId(this.employee.id);
  }
}
