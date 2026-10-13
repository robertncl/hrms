import { Routes } from '@angular/router';
import { ProjectDetailsComponent } from './project-details.component';
import { ProjectListComponent } from './project-list.component';
import { TimeOffManagementComponent } from './time-off-management.component';

export const routes: Routes = [
  { path: '', redirectTo: 'projects', pathMatch: 'full' },
  { path: 'projects', pathMatch: 'full', component: ProjectListComponent, title: 'Projects' },
  { path: 'projects/:id', component: ProjectDetailsComponent, title: 'Project' },
  { path: 'time-off', component: TimeOffManagementComponent, title: 'Time off' },
];
