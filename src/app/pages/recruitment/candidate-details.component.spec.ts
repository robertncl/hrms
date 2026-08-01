import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { CandidateDetailsComponent } from './candidate-details.component';
import { Candidate } from 'src/app/infrastructure/types/candidate';
import { CvEvaluationComponent } from './components/cv-evaluation.component';
import { InterviewPreparationComponent } from './components/interview-preparation.component';
import { InterviewFeedbackComponent } from './components/interview-feedback.component';
import { RejectionLetterComponent } from './components/rejection-letter.component';
import { OnboardingPreparationComponent } from './components/onboarding-preparation.component';
import { CandidateFinalizationComponent } from './components/candidate-finalization.component';

describe('CandidateDetailsComponent', () => {
  let component: CandidateDetailsComponent;
  let fixture: ComponentFixture<CandidateDetailsComponent>;

  const buildCandidate = (overrides: Partial<Candidate> = {}): Candidate => ({
    id: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    position: 'Developer',
    level: 'Senior',
    status: 'CV evaluation',
    offerAccepted: false,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandidateDetailsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CandidateDetailsComponent);
    component = fixture.componentInstance;
  });

  const setCandidate = (candidate: Candidate, previous?: Candidate) => {
    component.candidate = candidate;
    component.ngOnChanges({
      candidate: new SimpleChange(previous ?? null, candidate, previous === undefined),
    });
    fixture.detectChanges();
  };

  it('should create', () => {
    setCandidate(buildCandidate());
    expect(component).toBeTruthy();
  });

  it('should render candidate name, email and position', () => {
    setCandidate(buildCandidate());
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Jane Doe');
    expect(compiled.textContent).toContain('Email: jane.doe@example.com');
    expect(compiled.textContent).toContain('Developer');
  });

  it('should select CvEvaluationComponent for CV evaluation status', () => {
    setCandidate(buildCandidate({ status: 'CV evaluation' }));
    expect(component.actionsSection).toBe(CvEvaluationComponent);
  });

  it('should select InterviewPreparationComponent for Interview preparation status', () => {
    setCandidate(buildCandidate({ status: 'Interview preparation' }));
    expect(component.actionsSection).toBe(InterviewPreparationComponent);
  });

  it('should select InterviewFeedbackComponent for Interview Feedback status', () => {
    setCandidate(buildCandidate({ status: 'Interview Feedback' }));
    expect(component.actionsSection).toBe(InterviewFeedbackComponent);
  });

  it('should select RejectionLetterComponent for Rejected status', () => {
    setCandidate(buildCandidate({ status: 'Rejected' }));
    expect(component.actionsSection).toBe(RejectionLetterComponent);
  });

  it('should select OnboardingPreparationComponent for Approved status with accepted offer', () => {
    setCandidate(buildCandidate({ status: 'Approved', offerAccepted: true }));
    expect(component.actionsSection).toBe(OnboardingPreparationComponent);
  });

  it('should select CandidateFinalizationComponent for Approved status with pending offer', () => {
    setCandidate(buildCandidate({ status: 'Approved', offerAccepted: false }));
    expect(component.actionsSection).toBe(CandidateFinalizationComponent);
  });

  it('should throw for an unknown status', () => {
    component.candidate = buildCandidate({ status: 'Unknown' });
    expect(() =>
      component.ngOnChanges({
        candidate: new SimpleChange(null, component.candidate, true),
      })
    ).toThrowError('Unknown candidate status: Unknown');
  });

  it('should not recompute the actions section when candidate input is unchanged', () => {
    setCandidate(buildCandidate({ status: 'CV evaluation' }));
    component.actionsSection = null;
    component.ngOnChanges({});
    expect(component.actionsSection).toBeNull();
  });

  it('should render the resolved actions component with the candidateId input', () => {
    setCandidate(buildCandidate({ status: 'Rejected', id: 42 }));
    const rejectionEl = fixture.nativeElement.querySelector('app-rejection-letter');
    expect(rejectionEl).toBeTruthy();
    expect(rejectionEl.textContent).toContain('Rejection letter');
  });
});
