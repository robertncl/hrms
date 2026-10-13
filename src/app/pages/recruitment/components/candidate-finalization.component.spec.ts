import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandidateFinalizationComponent } from './candidate-finalization.component';
import { createMockWorkflow, provideStageTesting } from 'src/testing/candidate-workflow.mock';

describe('CandidateFinalizationComponent', () => {
  let workflow: ReturnType<typeof createMockWorkflow>;
  let component: CandidateFinalizationComponent;
  let fixture: ComponentFixture<CandidateFinalizationComponent>;

  beforeEach(async () => {
    workflow = createMockWorkflow();
    await TestBed.configureTestingModule({
      imports: [CandidateFinalizationComponent],
      providers: provideStageTesting(workflow),
    }).compileComponents();

    fixture = TestBed.createComponent(CandidateFinalizationComponent);
    component = fixture.componentInstance;
    component.candidateId = 1;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept a candidateId input', () => {
    expect(component.candidateId).toBe(1);
  });

  it('should render the finalization text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Candidate finalization');
  });

  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const button = (label: string) => buttons().find((b) => b.textContent!.trim() === label)!;

  it('should record an accepted offer', () => {
    button('Offer accepted').click();
    expect(workflow.save).toHaveBeenCalledWith({ offerAccepted: true });
  });

  it('should reject the candidate when the offer is declined', () => {
    button('Offer declined').click();
    expect(workflow.save).toHaveBeenCalledWith({ status: 'Rejected' });
  });
});
