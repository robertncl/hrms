import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EmployeeForm } from 'src/app/infrastructure/types/employee-form';

export const POSITIONS = ['Developer', 'Designer', 'QA', 'Manager'] as const;
export const LEVELS = ['Junior', 'Middle', 'Senior', 'Lead'] as const;

/** Shared inputs for the create and edit employee forms. Errors appear once a field is touched. */
@Component({
  selector: 'app-employee-form-fields',
  template: `
    <div class="form-grid" [formGroup]="form()">
      <div class="field">
        <label for="employee-first-name">First name</label>
        <input id="employee-first-name" type="text" placeholder="First Name" autocomplete="off"
          formControlName="firstName" [attr.aria-invalid]="showError('firstName')"
          aria-describedby="employee-first-name-error" />
        @if (showError('firstName')) {
          <span id="employee-first-name-error" class="error-msg">First name is required.</span>
        }
      </div>
      <div class="field">
        <label for="employee-last-name">Last name</label>
        <input id="employee-last-name" type="text" placeholder="Last Name" autocomplete="off"
          formControlName="lastName" [attr.aria-invalid]="showError('lastName')"
          aria-describedby="employee-last-name-error" />
        @if (showError('lastName')) {
          <span id="employee-last-name-error" class="error-msg">Last name is required.</span>
        }
      </div>
      <div class="field span-all">
        <label for="employee-email">Work email</label>
        <span id="employee-email-hint" class="hint">Format: name&#64;company.com</span>
        <input id="employee-email" type="email" autocomplete="off" formControlName="email"
          [attr.aria-invalid]="showError('email')" aria-describedby="employee-email-hint employee-email-error" />
        @if (showError('email')) {
          <span id="employee-email-error" class="error-msg">Enter a valid email address.</span>
        }
      </div>
      <div class="field">
        <label for="employee-position">Position</label>
        <select id="employee-position" formControlName="position" [attr.aria-invalid]="showError('position')"
          aria-describedby="employee-position-error">
          <option value="" disabled>Choose a position</option>
          @for (position of positions; track position) {
            <option [value]="position">{{ position }}</option>
          }
        </select>
        @if (showError('position')) {
          <span id="employee-position-error" class="error-msg">Choose a position.</span>
        }
      </div>
      <div class="field">
        <label for="employee-level">Level</label>
        <select id="employee-level" formControlName="level" [attr.aria-invalid]="showError('level')"
          aria-describedby="employee-level-error">
          <option value="" disabled>Choose a level</option>
          @for (level of levels; track level) {
            <option [value]="level">{{ level }}</option>
          }
        </select>
        @if (showError('level')) {
          <span id="employee-level-error" class="error-msg">Choose a level.</span>
        }
      </div>
    </div>
  `,
  imports: [ReactiveFormsModule],
})
export class EmployeeFormFieldsComponent {
  form = input.required<FormGroup<EmployeeForm>>();
  readonly positions = POSITIONS;
  readonly levels = LEVELS;

  showError(name: keyof EmployeeForm): boolean {
    const control = this.form().controls[name];
    return control.enabled && control.touched && control.invalid;
  }
}
