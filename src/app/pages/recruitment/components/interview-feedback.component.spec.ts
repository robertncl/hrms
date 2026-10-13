import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InterviewFeedbackComponent } from './interview-feedback.component';
import { createMockWorkflow, provideStageTesting } from 'src/testing/candidate-workflow.mock';

describe('InterviewFeedbackComponent', () => {
  let workflow: ReturnType<typeof createMockWorkflow>;
  let component: InterviewFeedbackComponent;
  let fixture: ComponentFixture<InterviewFeedbackComponent>;

  beforeEach(async () => {
    workflow = createMockWorkflow();
    await TestBed.configureTestingModule({
      imports: [InterviewFeedbackComponent],
      providers: provideStageTesting(workflow),
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

  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const button = (label: string) => buttons().find((b) => b.textContent!.trim() === label)!;

  it('should require a rating and feedback before a decision', () => {
    expect(button('Make an offer').disabled).toBeTrue();

    component.rating.set(4);
    component.feedback.set('  Strong candidate  ');
    fixture.detectChanges();

    button('Make an offer').click();
    expect(workflow.save).toHaveBeenCalledWith({ status: 'Approved', rating: 4, feedback: 'Strong candidate' });
  });
});
