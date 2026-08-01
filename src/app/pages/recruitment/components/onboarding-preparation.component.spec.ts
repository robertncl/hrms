import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OnboardingPreparationComponent } from './onboarding-preparation.component';

describe('OnboardingPreparationComponent', () => {
  let component: OnboardingPreparationComponent;
  let fixture: ComponentFixture<OnboardingPreparationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingPreparationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingPreparationComponent);
    component = fixture.componentInstance;
    component.candidateId = 5;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept a candidateId input', () => {
    expect(component.candidateId).toBe(5);
  });

  it('should render the onboarding preparation text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Onboarding preparation');
  });
});
