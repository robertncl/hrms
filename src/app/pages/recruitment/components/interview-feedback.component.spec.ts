import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InterviewFeedbackComponent } from './interview-feedback.component';

describe('InterviewFeedbackComponent', () => {
  let component: InterviewFeedbackComponent;
  let fixture: ComponentFixture<InterviewFeedbackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewFeedbackComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InterviewFeedbackComponent);
    component = fixture.componentInstance;
    component.candidateId = 3;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept a candidateId input', () => {
    expect(component.candidateId).toBe(3);
  });

  it('should render the interview feedback text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Interview feedback');
  });
});
