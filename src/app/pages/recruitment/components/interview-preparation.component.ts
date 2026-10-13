import { Component, Input, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EmployeeService } from 'src/app/services/employee.service';
import { CandidateWorkflow } from '../candidate-workflow';
import { daysFromToday } from 'src/app/demo/demo-data';

@Component({
  selector: 'app-interview-preparation',
  template: `
    <section class="card stage">
      <h3>Interview preparation</h3>
      @if (workflow.candidate(); as candidate) {
        <p class="muted">Schedule {{ candidate.firstName }}'s interview and pick who will run it.</p>
        <div class="form-grid">
          <div class="field">
            <label for="interview-date">Date</label>
            <input id="interview-date" type="date" [min]="today" [value]="date()" (input)="date.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label for="interviewer">Interviewer</label>
            <select id="interviewer" [value]="interviewerId()" (change)="interviewerId.set($any($event.target).value)">
              <option value="">Choose an interviewer</option>
              @for (employee of interviewers(); track employee.id) {
                <option [value]="employee.id">{{ employee.firstName }} {{ employee.lastName }} · {{ employee.position }}</option>
              }
            </select>
          </div>
        </div>
        <div class="stage-actions">
          <button class="btn" [disabled]="workflow.saving()" (click)="workflow.save({ status: 'Rejected' })">Reject</button>
          <button class="btn btn-primary" [disabled]="workflow.saving() || !date() || !interviewerId()" (click)="schedule()">
            Schedule interview
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: './stage.css',
  standalone: true,
})
export class InterviewPreparationComponent {
  @Input() candidateId!: number;
  readonly workflow = inject(CandidateWorkflow);
  private readonly employees = toSignal(inject(EmployeeService).getEmployees(), { initialValue: [] });
  readonly today = daysFromToday(0);

  // Senior people and leads run interviews.
  interviewers = computed(() =>
    this.employees().filter((e) => e.level === 'Senior' || e.level === 'Lead'),
  );
  date = signal(daysFromToday(3));
  interviewerId = signal('');

  schedule() {
    this.workflow.save({
      status: 'Interview Feedback',
      interviewDate: this.date(),
      interviewerId: Number(this.interviewerId()),
    });
  }
}
