import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EmployeeForm } from 'src/app/infrastructure/types/employee-form';

export const POSITIONS = ['Developer', 'Designer', 'QA', 'Manager'] as const;
export const LEVELS = ['Junior', 'Middle', 'Senior', 'Lead'] as const;

/**
 * Shared fields for the add and edit person forms, grouped the way the ACME
 * People form is: what they are called, then what they do. Each group gets a
 * short description column on the left so a long form stays scannable.
 *
 * Errors appear once a field is touched.
 */
@Component({
  selector: 'app-employee-form-fields',
  template: `
    <div class="form-sections" [formGroup]="form()">
      <div class="section-label">
        <strong>Basics</strong>
        <span>How they show up across ACME.</span>
      </div>
      <div class="card section-card">
        <div class="pair">
          <div class="field">
            <label for="employee-first-name">First name</label>
            <input id="employee-first-name" type="text" autocomplete="off"
              formControlName="firstName" [attr.aria-invalid]="showError('firstName')"
              aria-describedby="employee-first-name-error" />
            @if (showError('firstName')) {
              <span id="employee-first-name-error" class="error-msg">First name is required.</span>
            }
          </div>
          <div class="field">
            <label for="employee-last-name">Last name</label>
            <input id="employee-last-name" type="text" autocomplete="off"
              formControlName="lastName" [attr.aria-invalid]="showError('lastName')"
              aria-describedby="employee-last-name-error" />
            @if (showError('lastName')) {
              <span id="employee-last-name-error" class="error-msg">Last name is required.</span>
            }
          </div>
        </div>
        <div class="field">
          <label for="employee-email">Work email</label>
          <input id="employee-email" type="email" autocomplete="off" formControlName="email"
            [attr.aria-invalid]="showError('email')"
            aria-describedby="employee-email-hint employee-email-error" />
          @if (showError('email')) {
            <span id="employee-email-error" class="error-msg">Enter a valid email address, like name&#64;acme.com.</span>
          }
          <span id="employee-email-hint" class="hint">{{ emailHint() }}</span>
        </div>
      </div>

      <div class="section-label">
        <strong>Role</strong>
        <span>Sets their team and where they show up.</span>
      </div>
      <div class="card section-card">
        <div class="field">
          <span class="label" id="employee-position-label">Position</span>
          <div class="segmented" role="group" aria-labelledby="employee-position-label">
            @for (position of positions; track position) {
              <button class="seg" type="button" [attr.aria-pressed]="isPosition(position)"
                [disabled]="form().controls.position.disabled"
                (click)="setPosition(position)">{{ position }}</button>
            }
          </div>
          @if (showError('position')) {
            <span class="error-msg">Choose a position.</span>
          }
        </div>
        <div class="pair">
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
      </div>
    </div>
  `,
  styles: `
    .section-card {
      display: grid;
      gap: var(--acme-space-5);
      padding: var(--acme-space-6);
    }

    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--acme-space-5);
    }

    /* Four positions fit on one row, so a segmented control beats a select:
       every option is visible and reachable in one tap. */
    .segmented {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--acme-space-2);
    }
    .seg {
      min-height: var(--app-control-h);
      padding: 0 var(--acme-space-2);
      border: 1px solid var(--acme-color-border);
      border-radius: var(--acme-radius-md);
      background: var(--acme-color-surface-raised);
      color: var(--acme-color-text);
      font: 400 var(--acme-text-sm) / 1 var(--acme-font-sans);
      cursor: pointer;
      transition: border-color var(--acme-duration-base) var(--acme-ease-out);
    }
    .seg:hover:not(:disabled) { border-color: var(--acme-color-text-subtle); }
    .seg[aria-pressed='true'] {
      border: 2px solid var(--acme-color-selected);
      background: var(--acme-color-selected-soft);
      color: var(--acme-color-selected);
      font-weight: 600;
    }
    .seg:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 640px) {
      .pair { grid-template-columns: minmax(0, 1fr); }
      .segmented { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `,
  imports: [ReactiveFormsModule],
})
export class EmployeeFormFieldsComponent {
  form = input.required<FormGroup<EmployeeForm>>();
  /** Explains where a prefilled work email came from, on the add form only. */
  emailHint = input('Format: name@acme.com');

  readonly positions = POSITIONS;
  readonly levels = LEVELS;

  isPosition(position: string): boolean {
    return this.form().controls.position.value === position;
  }

  setPosition(position: string) {
    const control = this.form().controls.position;
    control.setValue(position);
    control.markAsTouched();
  }

  showError(name: keyof EmployeeForm): boolean {
    const control = this.form().controls[name];
    return control.enabled && control.touched && control.invalid;
  }
}
