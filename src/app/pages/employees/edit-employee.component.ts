import { Component, inject, DestroyRef, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeForm } from 'src/app/infrastructure/types/employee-form';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { EmployeeFormFieldsComponent } from './employee-form-fields.component';

@Component({
  selector: 'app-edit-employee',
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="page">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/employees">People</a>
          <span aria-hidden="true">/</span>
          <a [routerLink]="['/employees/details', employee.id]">
            {{ employee.firstName }} {{ employee.lastName }}
          </a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Edit</span>
        </nav>

        <div class="page-header">
          <div>
            <h1>Edit {{ employee.firstName }} {{ employee.lastName }}</h1>
            <p>Changes show up across ACME as soon as you save.</p>
          </div>
        </div>

        @if (!canEditPrivateDetails()) {
          <p class="alert alert-info">
            Name and email are private details. Your role can see them but not change them.
          </p>
        }

        <app-employee-form-fields [form]="form" />

        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }
      </div>

      <div class="form-bar">
        <a class="btn btn-ghost" [routerLink]="['/employees/details', employee.id]">Cancel</a>
        <button class="btn btn-primary" type="submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    /* Fill the routed outlet so the sticky save bar lands at the bottom
       of the viewport even when the form is short. */
    :host { display: flex; flex-direction: column; min-height: 100%; }
    form { display: flex; flex-direction: column; flex: 1; }
    .page { flex: 1; }
  `,
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EmployeeFormFieldsComponent],
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
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
        this.error.set("Those changes didn't save. Try again.");
      },
    });
  }
}
