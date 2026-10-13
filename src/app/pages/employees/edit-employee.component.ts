import { Component, inject, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeForm } from 'src/app/infrastructure/types/employee-form';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { IconComponent } from 'src/app/shared/components/icon.component';
import { EmployeeFormFieldsComponent } from './employee-form-fields.component';

@Component({
  selector: 'app-edit-employee',
  template: `
    <div class="page narrow">
      <div>
        <a class="back-link" [routerLink]="['/employees/details', employee.id]">
          <app-icon name="arrow-left" [size]="16" /> {{ employee.firstName }} {{ employee.lastName }}
        </a>
        <div class="page-header">
          <h1>Edit employee</h1>
        </div>
      </div>
      <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (!canEditPrivateDetails()) {
          <p class="alert alert-info">
            Name and email are private details. Your role can view them but not change them.
          </p>
        }
        <app-employee-form-fields [form]="form" />
        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }
        <div class="form-actions">
          <a class="btn" [routerLink]="['/employees/details', employee.id]">Cancel</a>
          <button class="btn btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .narrow { max-width: 720px; }
    .alert { margin-bottom: 1rem; }
  `,
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, EmployeeFormFieldsComponent],
})
export class EditEmployeeComponent implements OnInit {
  permissionsService = inject(PermissionsService);
  private readonly employeeService = inject(EmployeeService);
  private readonly router = inject(Router);
  destroyRef = inject(DestroyRef);
  route = inject(ActivatedRoute);
  employee!: Employee;
  canEditPrivateDetails = signal(true);
  saving = signal(false);
  error = signal('');
  form = new FormGroup<EmployeeForm>({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    position: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    level: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit() {
    this.employee = this.route.snapshot.data['employee'] as Employee;
    this.form.patchValue(this.employee);
    this.permissionsService.hasPermission('EditEmployeePrivateDetails').pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(hasPermission => {
      this.canEditPrivateDetails.set(hasPermission);
      if (!hasPermission) {
        this.form.controls.firstName.disable();
        this.form.controls.lastName.disable();
        this.form.controls.email.disable();
      } else {
        this.form.controls.firstName.enable();
        this.form.controls.lastName.enable();
        this.form.controls.email.enable();
      }
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    // form.value leaves out disabled controls, so only editable fields are sent.
    this.employeeService.updateEmployee(this.employee.id, this.form.value as Partial<Employee>).subscribe({
      next: () => this.router.navigate(['/employees/details', this.employee.id]),
      error: () => {
        this.saving.set(false);
        this.error.set('Your changes could not be saved. Please try again.');
      },
    });
  }
}
