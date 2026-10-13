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
import { IconComponent } from 'src/app/shared/components/icon.component';
import { candidateStage, candidateTone } from 'src/app/shared/functions/status-badge';
import { CandidateWorkflow } from './candidate-workflow';
import { CvEvaluationComponent } from './components/cv-evaluation.component';
import { InterviewPreparationComponent } from './components/interview-preparation.component';
import { InterviewFeedbackComponent } from './components/interview-feedback.component';
import { RejectionLetterComponent } from './components/rejection-letter.component';
import { OnboardingPreparationComponent } from './components/onboarding-preparation.component';
import { CandidateFinalizationComponent } from './components/candidate-finalization.component';

const STEPS = ['CV evaluation', 'Interview', 'Feedback', 'Offer', 'Onboarding'];

@Component({
  selector: 'app-candidate-details',
  template: `
    <div class="candidate-details page">
      <div>
        <a class="back-link" routerLink="/recruitment"><app-icon name="arrow-left" [size]="16" /> Candidates</a>
        <div class="page-header">
          <div class="profile">
            <app-avatar [name]="candidate.firstName + ' ' + candidate.lastName" size="3.5rem" />
            <div>
              <h2 class="name">{{ candidate.firstName }} {{ candidate.lastName }}</h2>
              <p>{{ candidate.position }} · {{ candidate.level }}</p>
            </div>
          </div>
          <span [class]="'badge badge-' + tone(candidate)">{{ stage(candidate) }}</span>
        </div>
      </div>

      @if (candidate.status === 'Rejected') {
        <p class="alert alert-error">This application was rejected.</p>
      } @else {
        <ol class="stepper" aria-label="Hiring progress">
          @for (step of steps; track step; let i = $index) {
            <li [class.done]="i < stepIndex()" [class.current]="i === stepIndex()"
              [attr.aria-current]="i === stepIndex() ? 'step' : null">
              <span class="dot" aria-hidden="true">{{ i < stepIndex() ? '✓' : i + 1 }}</span>
              <span class="step-label">{{ step }}</span>
            </li>
          }
        </ol>
      }

      @if (workflow.error()) {
        <p class="alert alert-error" role="alert">{{ workflow.error() }}</p>
      }

      <div class="layout">
        <div class="stage-slot">
          <ng-container *ngComponentOutlet="actionsSection; inputs: {candidateId: candidate.id}"></ng-container>
        </div>
        <aside class="card">
          <h3 class="card-title">Application</h3>
          <p>Email: <a [href]="'mailto:' + candidate.email">{{ candidate.email }}</a></p>
          <dl class="details-list">
            @if (candidate.appliedAt) {
              <dt>Applied</dt><dd>{{ candidate.appliedAt | date: 'mediumDate' }}</dd>
            }
            @if (candidate.interviewDate) {
              <dt>Interview</dt><dd>{{ candidate.interviewDate | date: 'mediumDate' }}</dd>
            }
            @if (interviewerName()) {
              <dt>Interviewer</dt><dd>{{ interviewerName() }}</dd>
            }
            @if (candidate.rating) {
              <dt>Rating</dt><dd>{{ candidate.rating }} / 5</dd>
            }
          </dl>
          @if (candidate.feedback) {
            <blockquote>{{ candidate.feedback }}</blockquote>
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    .profile { display: flex; align-items: center; gap: 1rem; }
    .name { font-size: 1.6rem; font-weight: 650; }
    .profile p { color: var(--text-secondary); }

    .stepper {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.5rem;
    }
    .stepper li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--radius-sm);
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 0.88rem;
    }
    .stepper li.current {
      border-color: var(--brand);
      color: var(--text);
      font-weight: 600;
    }
    .stepper li.done { color: var(--text); }
    .dot {
      display: grid;
      place-items: center;
      flex: none;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      background: var(--surface-2);
      font-size: 0.78rem;
      font-weight: 700;
    }
    .current .dot { background: var(--brand); color: var(--brand-text); }
    .done .dot { background: var(--brand-soft); color: var(--link); }

    .layout {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      align-items: start;
    }
    aside { display: grid; gap: 0.75rem; }
    aside .card-title { margin-bottom: 0; }
    blockquote {
      margin: 0;
      padding: 0.6rem 0.85rem;
      border-inline-start: 3px solid var(--border-strong);
      color: var(--text-secondary);
      font-style: italic;
    }
    @media (max-width: 860px) {
      .layout { grid-template-columns: minmax(0, 1fr); }
      .stepper { grid-template-columns: minmax(0, 1fr); }
    }
  `,
  standalone: true,
  imports: [NgComponentOutlet, DatePipe, RouterLink, AvatarComponent, IconComponent],
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
