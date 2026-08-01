import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RejectionLetterComponent } from './rejection-letter.component';

describe('RejectionLetterComponent', () => {
  let component: RejectionLetterComponent;
  let fixture: ComponentFixture<RejectionLetterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RejectionLetterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RejectionLetterComponent);
    component = fixture.componentInstance;
    component.candidateId = 6;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should accept a candidateId input', () => {
    expect(component.candidateId).toBe(6);
  });

  it('should render the rejection letter text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Rejection letter');
  });
});
