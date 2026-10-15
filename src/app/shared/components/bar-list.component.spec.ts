import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BarListComponent } from './bar-list.component';

describe('BarListComponent', () => {
  let fixture: ComponentFixture<BarListComponent>;
  const bars = () => Array.from(fixture.nativeElement.querySelectorAll('.bar') as NodeListOf<HTMLElement>);
  const values = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.value') as NodeListOf<HTMLElement>).map((v) => v.textContent!.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(BarListComponent);
    fixture.componentRef.setInput('items', [
      { label: 'A', value: 50 },
      { label: 'B', value: 25, link: '/b' },
    ]);
  });

  it('should scale bars to the largest value by default', () => {
    fixture.detectChanges();
    expect(bars().map((b) => b.style.flexBasis)).toEqual(['88%', '44%']);
    expect(values()).toEqual(['50', '25']);
  });

  it('should support a fixed scale and a unit', () => {
    fixture.componentRef.setInput('scaleMax', 100);
    fixture.componentRef.setInput('unit', '%');
    fixture.detectChanges();
    expect(bars().map((b) => b.style.flexBasis)).toEqual(['44%', '22%']);
    expect(values()).toEqual(['50%', '25%']);
  });

  it('should link labels that have a link', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a.label') as HTMLAnchorElement;
    expect(link.textContent).toContain('B');
    expect(link.getAttribute('href')).toBe('/b');
  });
});
