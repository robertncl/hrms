import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';

/**
 * Runs change detection after a plain (non-signal) property has been mutated.
 *
 * TestBed runs zoneless, so `fixture.detectChanges()` only refreshes views that
 * are already marked dirty, and mutating a plain property never marks one. The
 * view has to be marked via its own `ChangeDetectorRef` — the one on
 * `fixture.componentRef` belongs to the host view and does not have this effect.
 */
export function flushChanges(fixture: ComponentFixture<unknown>): void {
  fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
  fixture.detectChanges();
}
