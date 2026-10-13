import { Component, Input, computed, inject, signal } from '@angular/core';
import { CandidateWorkflow } from '../candidate-workflow';

@Component({
  selector: 'app-rejection-letter',
  template: `
    <section class="card stage">
      <h3>Rejection letter</h3>
      @if (workflow.candidate(); as candidate) {
        <p class="muted">The application is closed. Send {{ candidate.firstName }} this letter.</p>
        <pre class="letter">{{ letter() }}</pre>
        <div class="stage-actions">
          <button class="btn" [disabled]="workflow.saving()" (click)="workflow.save({ status: 'CV evaluation', offerAccepted: false })">
            Reopen application
          </button>
          <button class="btn btn-primary" (click)="copy()">{{ copied() ? 'Copied' : 'Copy letter' }}</button>
        </div>
        <span class="visually-hidden" aria-live="polite">{{ copied() ? 'Letter copied to clipboard' : '' }}</span>
      }
    </section>
  `,
  styleUrl: './stage.css',
  standalone: true,
})
export class RejectionLetterComponent {
  @Input() candidateId!: number;
  readonly workflow = inject(CandidateWorkflow);
  copied = signal(false);

  letter = computed(() => {
    const candidate = this.workflow.candidate();
    if (!candidate) {
      return '';
    }
    return `Dear ${candidate.firstName},

Thank you for your interest in the ${candidate.position} (${candidate.level}) role and for the time you spent with our team.

After careful consideration, we have decided not to move forward with your application. This was a difficult decision, and it does not diminish what you have achieved.

We would be glad to hear from you again for future openings.

Kind regards,
The People Team`;
  });

  async copy() {
    try {
      await navigator.clipboard.writeText(this.letter());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.copied.set(false);
    }
  }
}
