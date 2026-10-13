import { DatePipe } from '@angular/common';
import { Component, Input, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EmployeeService } from 'src/app/services/employee.service';
import { CandidateWorkflow } from '../candidate-workflow';

@Component({
    selector: 'app-interview-feedback',
    template: `
        <section class="card stage">
            <h3>Interview feedback</h3>
            @if (workflow.candidate(); as candidate) {
                <p class="muted">
                    @if (candidate.interviewDate) {
                        Interviewed on {{ candidate.interviewDate | date: 'mediumDate' }}{{ interviewerName() ? ' by ' + interviewerName() : '' }}.
                    }
                    Record the outcome to move the candidate on.
                </p>
                <fieldset>
                    <legend>Overall rating</legend>
                    <div class="rating">
                        @for (score of scores; track score) {
                            <label>
                                <input type="radio" name="rating" [value]="score" [checked]="rating() === score" (change)="rating.set(score)" />
                                {{ score }}
                            </label>
                        }
                    </div>
                </fieldset>
                <div class="field">
                    <label for="interview-notes">Feedback</label>
                    <textarea id="interview-notes" rows="4" placeholder="Strengths, concerns, recommendation…"
                        [value]="feedback()" (input)="feedback.set($any($event.target).value)"></textarea>
                </div>
                <div class="stage-actions">
                    <button class="btn" [disabled]="workflow.saving() || !canDecide()" (click)="decide('Rejected')">Reject</button>
                    <button class="btn btn-primary" [disabled]="workflow.saving() || !canDecide()" (click)="decide('Approved')">
                        Make an offer
                    </button>
                </div>
                @if (!canDecide()) {
                    <p class="muted small">Add a rating and written feedback to record a decision.</p>
                }
            }
        </section>
    `,
    styleUrl: './stage.css',
    standalone: true,
    imports: [DatePipe],
})
export class InterviewFeedbackComponent {
    @Input() candidateId!: number;
    readonly workflow = inject(CandidateWorkflow);
    private readonly employees = toSignal(inject(EmployeeService).getEmployees(), { initialValue: [] });
    readonly scores = [1, 2, 3, 4, 5];
    rating = signal(0);
    feedback = signal('');
    canDecide = computed(() => this.rating() > 0 && this.feedback().trim().length > 0);

    interviewerName = computed(() => {
        const id = this.workflow.candidate()?.interviewerId;
        const employee = this.employees().find((e) => e.id === id);
        return employee ? `${employee.firstName} ${employee.lastName}` : '';
    });

    decide(status: 'Approved' | 'Rejected') {
        this.workflow.save({ status, rating: this.rating(), feedback: this.feedback().trim() });
    }
}
