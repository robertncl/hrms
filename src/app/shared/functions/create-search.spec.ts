import { DestroyRef } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { createSearch } from './create-search';

describe('createSearch', () => {
  let onDestroyCallback: () => void;

  const mockDestroyRef: Partial<DestroyRef> = {
    onDestroy: (callback: () => void) => {
      onDestroyCallback = callback;
      return () => {};
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should not emit before the debounce time elapses', fakeAsync(() => {
    const control = new FormControl('');
    const values: (string | null)[] = [];

    TestBed.runInInjectionContext(() => {
      createSearch(control, mockDestroyRef as DestroyRef).subscribe((value) => values.push(value));
    });

    control.setValue('a');
    tick(499);

    expect(values).toEqual([]);
    tick(1);
  }));

  it('should emit the debounced value after 500ms', fakeAsync(() => {
    const control = new FormControl('');
    const values: (string | null)[] = [];

    TestBed.runInInjectionContext(() => {
      createSearch(control, mockDestroyRef as DestroyRef).subscribe((value) => values.push(value));
    });

    control.setValue('john');
    tick(500);

    expect(values).toEqual(['john']);
  }));

  it('should only emit the latest value when multiple changes happen within the debounce window', fakeAsync(() => {
    const control = new FormControl('');
    const values: (string | null)[] = [];

    TestBed.runInInjectionContext(() => {
      createSearch(control, mockDestroyRef as DestroyRef).subscribe((value) => values.push(value));
    });

    control.setValue('j');
    tick(100);
    control.setValue('jo');
    tick(100);
    control.setValue('john');
    tick(500);

    expect(values).toEqual(['john']);
  }));

  it('should stop emitting once destroyRef fires onDestroy', fakeAsync(() => {
    const control = new FormControl('');
    const values: (string | null)[] = [];
    let completed = false;

    TestBed.runInInjectionContext(() => {
      createSearch(control, mockDestroyRef as DestroyRef).subscribe({
        next: (value) => values.push(value),
        complete: () => (completed = true),
      });
    });

    onDestroyCallback();

    control.setValue('after-destroy');
    tick(500);

    expect(values).toEqual([]);
    expect(completed).toBeTrue();
  }));

  it('should use the real DestroyRef when none is provided explicitly', fakeAsync(() => {
    const control = new FormControl('');
    const values: (string | null)[] = [];

    TestBed.runInInjectionContext(() => {
      createSearch(control).subscribe((value) => values.push(value));
    });

    control.setValue('default');
    tick(500);

    expect(values).toEqual(['default']);
  }));
});
