import { Routes } from '@angular/router';
import { EmployeeListComponent } from './employee-list.component';
import { EmployeeDetailsComponent } from './employee-details.component';
import { EditEmployeeComponent } from './edit-employee.component';
import { CreateEmployeeComponent } from './create-employee.component';
import { employeeDetailsResolver } from 'src/app/shared/resolvers/employee-details.resolver';

export const routes: Routes = [
    { path: '', redirectTo: 'list', pathMatch: 'full' },
    { path: 'list', component: EmployeeListComponent, title: 'Employees' },
    {
        path: 'details/:id',
        component: EmployeeDetailsComponent,
        title: 'Employee',
        resolve: { employee: employeeDetailsResolver },
    },
    { path: 'create', component: CreateEmployeeComponent, title: 'Add employee' },
    {
        path: 'edit/:id',
        component: EditEmployeeComponent,
        title: 'Edit employee',
        resolve: { employee: employeeDetailsResolver },
    },
];
