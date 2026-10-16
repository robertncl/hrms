import { Component, Input, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeService } from 'src/app/services/employee.service';
import { PermissionsService } from 'src/app/services/permissions.service';
import { CandidateWorkflow } from '../candidate-workflow';
import { workEmail } from 'src/app/demo/demo-data';

const CHECKLIST = ['Laptop and equipment ordered', 'Accounts and access requested', 'Onboarding buddy assigned', 'Welcome email sent'];

@Component({
  selector: 'app-onboarding-preparation',
  template: `
    <section class="card stage">
      <h3>Onboarding preparation</h3>
      @if (workflow.candidate(); as candidate) {
        @if (candidate.employeeId) {
          <p class="alert alert-info">
            {{ candidate.firstName }} has joined the team.
            <a [routerLink]="['/employees/details', candidate.employeeId]">View their employee profile</a>
          </p>
        } @else {
          <p class="muted">{{ candidate.firstName }} accepted the offer. Get everything ready for day one.</p>
          <fieldset>
            <legend>Before the first day</legend>
            @for (item of checklist; track item; let i = $index) {
              <label class="check">
                <input type="checkbox" [checked]="done()[i]" (change)="toggle(i)" />
                {{ item }}
              </label>
            }
          </fieldset>
          @if (canCreateEmployee()) {
            <div class="stage-actions">
              <button class="btn btn-primary" [disabled]="workflow.saving() || !allDone()" (click)="hire()">
                Create employee record
              </button>
            </div>
            @if (!allDone()) {
              <p class="muted small">Complete the checklist to create the employee record.</p>
            }
          } @else {
            <p class="muted small">
              When the checklist is done, a recruiter or HR administrator creates {{ candidate.firstName }}'s employee record.
            </p>
          }
        }
      }
    </section>
  `,
  styleUrl: './stage.css',
  standalone: true,
  imports: [RouterLink],
})
export class OnboardingPreparationComponent {
  @Input() candidateId!: number;
  readonly workflow = inject(CandidateWorkflow);
  private readonly employeeService = inject(EmployeeService);
  /** Hiring managers prepare onboarding; adding someone to People is for recruiters and HR. */
  canCreateEmployee = inject(PermissionsService).can('CreateEmployee');
  readonly checklist = CHECKLIST;
  done = signal(CHECKLIST.map(() => false));
  allDone = computed(() => this.done().every(Boolean));

  toggle(index: number) {
    this.done.update((values) => values.map((value, i) => (i === index ? !value : value)));
  }

  hire() {
    const candidate = this.workflow.candidate();
    if (!candidate) {
      return;
    }
    this.employeeService.createEmployee({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: workEmail(candidate.firstName, candidate.lastName),
      position: candidate.position as Employee['position'],
      level: candidate.level as Employee['level'],
    }).pipe(
      switchMap((employee) => this.workflow.update({ employeeId: employee.id })),
    ).subscribe({ error: () => undefined });
  }
}
