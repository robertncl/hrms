import { Routes } from '@angular/router';
import { permissionGuard } from 'src/app/shared/guards/permission.guard';
import { CourseDetailsComponent } from './course-details.component';
import { CourseFormComponent } from './course-form.component';
import { LearningOverviewComponent } from './learning-overview.component';

const canManageCourses = permissionGuard('ManageCourses', '/learning');

export const routes: Routes = [
  { path: '', component: LearningOverviewComponent, title: 'Learning' },
  { path: 'courses/new', component: CourseFormComponent, title: 'New course', canActivate: [canManageCourses] },
  { path: 'courses/:id', component: CourseDetailsComponent, title: 'Course' },
  { path: 'courses/:id/edit', component: CourseFormComponent, title: 'Edit course', canActivate: [canManageCourses] },
];
