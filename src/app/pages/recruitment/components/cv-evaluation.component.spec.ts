import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CvEvaluationComponent } from './cv-evaluation.component';

describe('CvEvaluationComponent', () => {
  let component: CvEvaluationComponent;
  let fixture: ComponentFixture<CvEvaluationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CvEvaluationComponent],
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
});
