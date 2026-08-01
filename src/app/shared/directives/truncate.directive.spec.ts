import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TruncateDirective, TruncateLimit } from './truncate.directive';

const LONG_TEXT = 'a'.repeat(200);

@Component({
  standalone: true,
  imports: [TruncateDirective],
  template: `<p appTruncate>{{ text }}</p>`,
})
class HostComponent {
  text = LONG_TEXT;
}

describe('TruncateDirective', () => {
  describe('with the app TruncateLimit provided (70)', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [{ provide: TruncateLimit, useValue: 70 }],
      }).compileComponents();

      fixture = TestBed.createComponent(HostComponent);
    });

    it('should truncate the text content to the provided limit', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement.querySelector('p');
      expect(el.textContent).toBe(LONG_TEXT.slice(0, 70));
      expect(el.textContent?.length).toBe(70);
    });
  });

  describe('without TruncateLimit provided', () => {
    let fixture: ComponentFixture<HostComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [HostComponent],
      }).compileComponents();

      fixture = TestBed.createComponent(HostComponent);
    });

    it('should default the limit to 80 characters', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement.querySelector('p');
      expect(el.textContent).toBe(LONG_TEXT.slice(0, 80));
      expect(el.textContent?.length).toBe(80);
    });
  });

  describe('with short text', () => {
    @Component({
      standalone: true,
      imports: [TruncateDirective],
      template: `<p appTruncate>Short text</p>`,
    })
    class ShortTextHostComponent {}

    it('should leave text shorter than the limit untouched', async () => {
      await TestBed.configureTestingModule({
        imports: [ShortTextHostComponent],
        providers: [{ provide: TruncateLimit, useValue: 70 }],
      }).compileComponents();

      const fixture = TestBed.createComponent(ShortTextHostComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement.querySelector('p');
      expect(el.textContent).toBe('Short text');
    });
  });
});
