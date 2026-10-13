import { Component, Input, inject } from '@angular/core';
import { CandidateWorkflow } from '../candidate-workflow';

@Component({
  selector: 'app-candidate-finalization',
  template: `
    <section class="card stage">
      <h3>Candidate finalization</h3>
      @if (workflow.candidate(); as candidate) {
        <p class="muted">
          An offer for <strong>{{ candidate.position }} ({{ candidate.level }})</strong> has been sent to
          {{ candidate.firstName }}. Record their answer.
        </p>
        <div class="stage-actions">
          <button class="btn" [disabled]="workflow.saving()" (click)="workflow.save({ status: 'Rejected' })">
            Offer declined
          </button>
          <button class="btn btn-primary" [disabled]="workflow.saving()" (click)="workflow.save({ offerAccepted: true })">
            Offer accepted
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: './stage.css',
  standalone: true,
})
export class CandidateFinalizationComponent {
  @Input() candidateId!: number;
  readonly workflow = inject(CandidateWorkflow);
}
