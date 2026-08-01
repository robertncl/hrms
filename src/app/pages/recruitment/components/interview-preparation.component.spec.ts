import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InterviewPreparationComponent } from './interview-preparation.component';

describe('InterviewPreparationComponent', () => {
  let component: InterviewPreparationComponent;
  let fixture: ComponentFixture<InterviewPreparationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewPreparationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InterviewPreparationComponent);
    component = fixture.componentInstance;
    component.candidateId = 4;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept a candidateId input', () => {
    expect(component.candidateId).toBe(4);
  });

  it('should render the interview preparation text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Interview preparation');
  });
});
