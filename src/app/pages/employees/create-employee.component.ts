import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EmployeeForm } from 'src/app/infrastructure/types/employee-form';
import { EmployeeService, NewEmployee } from 'src/app/services/employee.service';
import { workEmail } from 'src/app/demo/demo-data';
import { EmployeeFormFieldsComponent } from './employee-form-fields.component';

@Component({
  selector: 'app-create-employee',
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="page">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/employees">People</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Add person</span>
        </nav>

        <div class="page-header">
          <div>
            <h1>Add a person</h1>
            <p>They show up across ACME as soon as you save.</p>
          </div>
        </div>

        <app-employee-form-fields [form]="form" [emailHint]="emailHint()" />

        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }
      </div>

      <div class="form-bar">
        <a class="btn btn-ghost" routerLink="/employees">Cancel</a>
        <button class="btn btn-primary" type="submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Add person' }}
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
export class CreateEmployeeComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly router = inject(Router);

  saving = signal(false);
  error = signal('');
  /** Tracks whether the work email was typed, so autofill stops interfering. */
  private emailEdited = false;

  form = new FormGroup<EmployeeForm>({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    position: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    level: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  emailHint = signal('Format: name@acme.com');

  constructor() {
    // Work emails follow from the name here, so fill one in and say so —
    // but never overwrite an address somebody has typed themselves.
    this.form.controls.email.valueChanges.subscribe(() => {
      if (this.form.controls.email.dirty) {
        this.emailEdited = true;
      }
    });

    this.form.controls.firstName.valueChanges.subscribe(() => this.fillEmail());
    this.form.controls.lastName.valueChanges.subscribe(() => this.fillEmail());
  }

  private fillEmail() {
    if (this.emailEdited) return;
    const { firstName, lastName } = this.form.getRawValue();
    if (!firstName.trim() || !lastName.trim()) return;
    this.form.controls.email.setValue(workEmail(firstName, lastName), { emitEvent: false });
    this.emailHint.set('Filled in from their name. Change it if they go by something else.');
  }

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
        this.error.set("That didn't save. Check the details and try again.");
      },
    });
  }
}
