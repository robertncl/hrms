import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TooltipDirective } from './tooltip.directive';
import { flushChanges } from 'src/testing/flush-changes';

@Component({
  standalone: true,
  imports: [TooltipDirective],
  template: `<appTooltip [tooltip]="tooltipText"></appTooltip>`,
})
class HostComponent {
  tooltipText = 'Hello world';
}

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
  });

  it('should create an instance', () => {
    fixture.detectChanges();
    const directiveEl = fixture.debugElement.children[0];
    expect(directiveEl.injector.get(TooltipDirective)).toBeTruthy();
  });

  it('should bind the tooltip input to the title attribute', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement.querySelector('appTooltip');
    expect(el.getAttribute('title')).toBe('Hello world');
  });

  it('should update the title attribute when the tooltip input changes', () => {
    fixture.detectChanges();
    fixture.componentInstance.tooltipText = 'Updated tooltip';
    flushChanges(fixture);
    const el: HTMLElement = fixture.nativeElement.querySelector('appTooltip');
    expect(el.getAttribute('title')).toBe('Updated tooltip');
  });
});
