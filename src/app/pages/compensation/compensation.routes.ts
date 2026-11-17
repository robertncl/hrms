import { Routes } from '@angular/router';
import { permissionGuard } from 'src/app/shared/guards/permission.guard';
import { CompensationDetailsComponent } from './compensation-details.component';
import { CompensationOverviewComponent } from './compensation-overview.component';

export const routes: Routes = [
  {
    path: '',
    component: CompensationOverviewComponent,
    title: 'Compensation',
    canActivate: [permissionGuard('ViewCompensation', '/employees')],
  },
  // Everyone may open their own; the page says so when it's someone else's they can't see.
  { path: ':id', component: CompensationDetailsComponent, title: 'Pay and equity' },
];
