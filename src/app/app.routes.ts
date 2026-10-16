import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login.component';
import { ShellComponent } from './layout/shell.component';
import { InfoPageComponent } from './pages/info-page.component';
import { authGuard, guestGuard } from './shared/guards/auth.guard';
import { permissionGuard } from './shared/guards/permission.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard], title: 'Sign in' },
  {
    path: 'registration',
    canActivate: [guestGuard],
    title: 'Create account',
    loadComponent: () => {
      return import('./pages/registration.component').then(
        (m) => m.RegistrationComponent
      );
    },
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => {
          return import('./pages/dashboard.component').then((m) => m.DashboardComponent);
        },
      },
      {
        path: 'employees',
        loadChildren: () => {
          return import('./pages/employees/employees.routes').then((m) => m.routes);
        },
      },
      {
        path: 'recruitment',
        canActivate: [permissionGuard('ManageHiring', '/dashboard')],
        loadChildren: () => {
          return import('./pages/recruitment/recruitment.routes').then((m) => m.routes);
        },
      },
      {
        path: 'learning',
        loadChildren: () => {
          return import('./pages/learning/learning.routes').then((m) => m.routes);
        },
      },
      {
        path: 'work',
        loadChildren: () => {
          return import('./pages/work/work.routes').then((m) => m.routes);
        },
      },
      {
        path: 'terms',
        component: InfoPageComponent,
        title: 'Terms of Service',
        data: { heading: 'Terms of Service', body: 'Use this demo to explore how an HR management system can work. There are no warranties, and the data may be reset at any time.' },
      },
      {
        path: 'privacy',
        component: InfoPageComponent,
        title: 'Privacy Policy',
        data: { heading: 'Privacy Policy', body: 'No personal data leaves your browser. Accounts, employees and requests you create are kept in local storage on this device.' },
      },
      {
        path: 'cookies',
        component: InfoPageComponent,
        title: 'Cookies Policy',
        data: { heading: 'Cookies Policy', body: 'The demo sets no cookies. It uses session storage for your sign-in and local storage for demo data.' },
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => {
          return import('./pages/not-found.component').then((m) => m.NotFoundComponent);
        },
      },
    ],
  },
];
