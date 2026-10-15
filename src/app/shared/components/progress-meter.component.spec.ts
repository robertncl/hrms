import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProgressMeterComponent } from './progress-meter.component';

describe('ProgressMeterComponent', () => {
  let fixture: ComponentFixture<ProgressMeterComponent>;
  const meter = () => fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProgressMeterComponent);
  });

  it('should expose the value to assistive technology and as text', () => {
    fixture.componentRef.setInput('value', 42.4);
    fixture.componentRef.setInput('label', 'Course completion');
    fixture.detectChanges();

    expect(meter().getAttribute('aria-valuenow')).toBe('42');
    expect(meter().getAttribute('aria-label')).toBe('Course completion');
    expect(fixture.nativeElement.textContent).toContain('42%');
    expect((meter().firstElementChild as HTMLElement).style.width).toBe('42%');
  });

  it('should clamp values outside 0–100', () => {
    fixture.componentRef.setInput('value', 140);
    fixture.detectChanges();
    expect(meter().getAttribute('aria-valuenow')).toBe('100');

    fixture.componentRef.setInput('value', -5);
    fixture.detectChanges();
    expect(meter().getAttribute('aria-valuenow')).toBe('0');
  });
});
