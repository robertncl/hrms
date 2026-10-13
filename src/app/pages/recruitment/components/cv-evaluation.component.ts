import { Component, Input, computed, inject, signal } from '@angular/core';
import { CandidateWorkflow } from '../candidate-workflow';

const CRITERIA = ['Relevant experience for the level', 'Skills match the role', 'Clear, well-structured CV'];

@Component({
    selector: 'app-cv-evaluation',
    template: `
        <section class="card stage">
            <h3>CV evaluation</h3>
            @if (workflow.candidate(); as candidate) {
                <p class="muted">
                    Screen {{ candidate.firstName }}'s application for {{ candidate.position }} ({{ candidate.level }}).
                </p>
                <fieldset>
                    <legend>Screening checklist</legend>
                    @for (criterion of criteria; track criterion; let i = $index) {
                        <label class="check">
                            <input type="checkbox" [checked]="checked()[i]" (change)="toggle(i)" />
                            {{ criterion }}
                        </label>
                    }
                </fieldset>
                <div class="stage-actions">
                    <button class="btn" [disabled]="workflow.saving()" (click)="workflow.save({ status: 'Rejected' })">Reject</button>
                    <button class="btn btn-primary" [disabled]="workflow.saving() || !allChecked()"
                        (click)="workflow.save({ status: 'Interview preparation' })">
                        Shortlist for interview
                    </button>
                </div>
                @if (!allChecked()) {
                    <p class="muted small">Tick every criterion to shortlist the candidate.</p>
                }
            }
        </section>
    `,
    styleUrl: './stage.css',
    standalone: true,
})
export class CvEvaluationComponent {
    @Input() candidateId!: number;
    readonly workflow = inject(CandidateWorkflow);
    readonly criteria = CRITERIA;
    checked = signal(CRITERIA.map(() => false));
    allChecked = computed(() => this.checked().every(Boolean));

    toggle(index: number) {
        this.checked.update((values) => values.map((value, i) => (i === index ? !value : value)));
    }
}
