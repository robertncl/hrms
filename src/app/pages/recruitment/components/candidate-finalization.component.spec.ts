import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandidateFinalizationComponent } from './candidate-finalization.component';

describe('CandidateFinalizationComponent', () => {
  let component: CandidateFinalizationComponent;
  let fixture: ComponentFixture<CandidateFinalizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandidateFinalizationComponent],
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
});
