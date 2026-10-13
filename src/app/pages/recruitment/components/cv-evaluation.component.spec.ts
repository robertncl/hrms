import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CvEvaluationComponent } from './cv-evaluation.component';
import { createMockWorkflow, provideStageTesting } from 'src/testing/candidate-workflow.mock';

describe('CvEvaluationComponent', () => {
  let workflow: ReturnType<typeof createMockWorkflow>;
  let component: CvEvaluationComponent;
  let fixture: ComponentFixture<CvEvaluationComponent>;

  beforeEach(async () => {
    workflow = createMockWorkflow();
    await TestBed.configureTestingModule({
      imports: [CvEvaluationComponent],
      providers: provideStageTesting(workflow),
    }).compileComponents();

    fixture = TestBed.createComponent(CvEvaluationComponent);
    component = fixture.componentInstance;
    component.candidateId = 2;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept a candidateId input', () => {
    expect(component.candidateId).toBe(2);
  });

  it('should render the CV evaluation text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('CV evaluation');
  });

  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const button = (label: string) => buttons().find((b) => b.textContent!.trim() === label)!;

  it('should only allow shortlisting once every criterion is ticked', () => {
    expect(button('Shortlist for interview').disabled).toBeTrue();

    (fixture.nativeElement.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>)
      .forEach((checkbox) => checkbox.click());
    fixture.detectChanges();

    button('Shortlist for interview').click();
    expect(workflow.save).toHaveBeenCalledWith({ status: 'Interview preparation' });
  });

  it('should reject the candidate', () => {
    button('Reject').click();
    expect(workflow.save).toHaveBeenCalledWith({ status: 'Rejected' });
  });
});
