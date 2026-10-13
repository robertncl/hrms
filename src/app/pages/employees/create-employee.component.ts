import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EmployeeForm } from 'src/app/infrastructure/types/employee-form';
import { EmployeeService, NewEmployee } from 'src/app/services/employee.service';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { EmployeeFormFieldsComponent } from './employee-form-fields.component';

@Component({
  selector: 'app-create-employee',
  template: `
    <div class="page narrow">
      <div>
        <a class="back-link" routerLink="/employees"><app-icon name="arrow-left" [size]="16" /> Employees</a>
        <div class="page-header">
          <h1>Add employee</h1>
        </div>
      </div>
      <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <app-employee-form-fields [form]="form" />
        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }
        <div class="form-actions">
          <a class="btn" routerLink="/employees">Cancel</a>
          <button class="btn btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Add employee' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `.narrow { max-width: 720px; }`,
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, EmployeeFormFieldsComponent],
})
export class CreateEmployeeComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly router = inject(Router);
  saving = signal(false);
  error = signal('');
  form = new FormGroup<EmployeeForm>({
    firstName: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    lastName: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    email: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.email]}),
    position: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    level: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.employeeService.createEmployee(this.form.value as NewEmployee).subscribe({
      next: (employee) => this.router.navigate(['/employees/details', employee.id]),
      error: () => {
        this.saving.set(false);
        this.error.set('The employee could not be saved. Please try again.');
      },
    });
  }
}
