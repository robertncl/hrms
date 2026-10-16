import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  Type,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, NgComponentOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { EmployeeService } from 'src/app/services/employee.service';
import { AvatarComponent } from 'src/app/shared/components/avatar.component';
import { candidateStage, candidateTone } from 'src/app/shared/functions/status-badge';
import { CandidateWorkflow } from './candidate-workflow';
import { CvEvaluationComponent } from './components/cv-evaluation.component';
import { InterviewPreparationComponent } from './components/interview-preparation.component';
import { InterviewFeedbackComponent } from './components/interview-feedback.component';
import { RejectionLetterComponent } from './components/rejection-letter.component';
import { OnboardingPreparationComponent } from './components/onboarding-preparation.component';
import { CandidateFinalizationComponent } from './components/candidate-finalization.component';

const STEPS = ['CV', 'Interview', 'Feedback', 'Offer', 'Onboarding'];

@Component({
  selector: 'app-candidate-details',
  template: `
    <div class="page">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a routerLink="/recruitment">Hiring</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ candidate.firstName }} {{ candidate.lastName }}</span>
      </nav>

      <div class="candidate-head">
        <app-avatar [name]="candidate.firstName + ' ' + candidate.lastName" size="3rem" />
        <div class="who">
          <h1>{{ candidate.firstName }} {{ candidate.lastName }}</h1>
          <div class="meta">
            <span>{{ candidate.level }} {{ candidate.position.toLowerCase() }}</span>
            @if (candidate.appliedAt) {
              <span aria-hidden="true">·</span>
              <span>applied {{ candidate.appliedAt | date: 'd MMM' }}</span>
            }
            <span aria-hidden="true">·</span>
            <a [href]="'mailto:' + candidate.email">{{ candidate.email }}</a>
          </div>
        </div>
        <span [class]="'badge badge-' + tone(candidate)">{{ stage(candidate) }}</span>
      </div>

      @if (candidate.status === 'Rejected') {
        <p class="alert alert-error">This application was rejected.</p>
      } @else {
        <ol class="stages" aria-label="Hiring progress">
          @for (step of steps; track step; let i = $index) {
            <li [class.is-done]="i < stepIndex()" [class.is-current]="i === stepIndex()"
              [attr.aria-current]="i === stepIndex() ? 'step' : null">
              <span class="s-bar" aria-hidden="true"></span>
              <span class="s-label">{{ step }}</span>
            </li>
          }
        </ol>
      }

      @if (workflow.error()) {
        <p class="alert alert-error" role="alert">{{ workflow.error() }}</p>
      }

      <div class="split">
        <div class="card stage-slot">
          <ng-container *ngComponentOutlet="actionsSection; inputs: {candidateId: candidate.id}"></ng-container>
        </div>

        <div class="stack">
          <section class="card" aria-labelledby="application-title">
            <h2 id="application-title">Application</h2>
            <dl class="details-list">
              @if (candidate.appliedAt) {
                <dt>Applied</dt><dd>{{ candidate.appliedAt | date: 'd MMM y' }}</dd>
              }
              @if (candidate.interviewDate) {
                <dt>Interview</dt><dd>{{ candidate.interviewDate | date: 'd MMM y' }}</dd>
              }
              @if (interviewerName()) {
                <dt>Interviewer</dt><dd>{{ interviewerName() }}</dd>
              }
              @if (candidate.rating) {
                <dt>Rating</dt><dd class="num">{{ candidate.rating }} of 5</dd>
              }
              <dt>Email</dt>
              <dd><a [href]="'mailto:' + candidate.email">{{ candidate.email }}</a></dd>
            </dl>
          </section>

          @if (candidate.feedback) {
            <section class="card" aria-labelledby="feedback-title">
              <h2 id="feedback-title">Feedback</h2>
              <blockquote>{{ candidate.feedback }}</blockquote>
            </section>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .candidate-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--acme-space-4);
    }
    .candidate-head .who { flex: 1 1 16rem; }
    .candidate-head h1 { margin: 0; font-size: var(--acme-text-3xl); }

    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--acme-space-2);
      margin-top: var(--acme-space-1);
      font-size: var(--acme-text-sm);
      color: var(--acme-color-text-muted);
    }
    .meta a { text-decoration: none; }
    .meta a:hover { text-decoration: underline; }

    .stages { margin: 0; padding: 0; }

    .stage-slot { align-self: start; }

    blockquote {
      margin: 0;
      font-size: var(--acme-text-sm);
      line-height: var(--acme-leading-relaxed);
      color: var(--acme-color-text-muted);
    }
  `,
  standalone: true,
  imports: [NgComponentOutlet, DatePipe, RouterLink, AvatarComponent],
  providers: [CandidateWorkflow],
})
export class CandidateDetailsComponent implements OnChanges {
  @Input() candidate!: Candidate;
  actionsSection: Type<any> | null = null;
  readonly workflow = inject(CandidateWorkflow);
  readonly steps = STEPS;
  stage = candidateStage;
  tone = candidateTone;

  private readonly employees = toSignal(
    inject(EmployeeService).getEmployees().pipe(map((list) => new Map(list.map((e) => [e.id, e])))),
  );

  constructor() {
    const changeDetector = inject(ChangeDetectorRef);
    // A stage component saved a change: show the next stage. The update comes
    // from an HTTP callback, so request a render rather than relying on zone.js.
    this.workflow.updated$.pipe(takeUntilDestroyed()).subscribe((candidate) => {
      this.candidate = candidate;
      this.actionsSection = this.selectActionsComponent();
      changeDetector.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['candidate']) {
      this.workflow.candidate.set(this.candidate);
      this.actionsSection = this.selectActionsComponent();
    }
  }

  stepIndex(): number {
    switch (this.candidate.status) {
      case 'CV evaluation':
        return 0;
      case 'Interview preparation':
        return 1;
      case 'Interview Feedback':
        return 2;
      case 'Approved':
        return this.candidate.employeeId ? STEPS.length : this.candidate.offerAccepted ? 4 : 3;
      default:
        return -1;
    }
  }

  interviewerName(): string {
    const employee = this.employees()?.get(this.candidate.interviewerId ?? -1);
    return employee ? `${employee.firstName} ${employee.lastName}` : '';
  }

  private selectActionsComponent(): Type<any> {
    switch (this.candidate.status) {
      case 'CV evaluation':
        return CvEvaluationComponent;
      case 'Interview preparation':
        return InterviewPreparationComponent;
      case 'Interview Feedback':
        return InterviewFeedbackComponent;
      case 'Rejected':
        return RejectionLetterComponent;
      case 'Approved':
        return this.candidate.offerAccepted
          ? OnboardingPreparationComponent
          : CandidateFinalizationComponent;
      default:
        throw new Error(`Unknown candidate status: ${this.candidate.status}`);
    }
  }
}
