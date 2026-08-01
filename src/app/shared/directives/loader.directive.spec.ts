import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LoaderDirective } from './loader.directive';
import { LoaderComponent } from '../components/loader.component';
import { flushChanges } from 'src/testing/flush-changes';

@Component({
  standalone: true,
  imports: [LoaderDirective],
  template: `<div *loading="isLoading">Content</div>`,
})
class HostComponent {
  isLoading = false;
}

describe('LoaderDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
  });

  it('should render an app-loader component wrapping the template content', () => {
    fixture.detectChanges();
    const loaderComponent = fixture.debugElement.query(By.directive(LoaderComponent));
    expect(loaderComponent).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Content');
  });

  it('should pass the loading input through to the loader component', () => {
    fixture.componentInstance.isLoading = true;
    flushChanges(fixture);
    const loaderComponent = fixture.debugElement.query(By.directive(LoaderComponent));
    expect(loaderComponent.componentInstance.loading).toBeTrue();
  });

  it('should update the loader component when the loading input changes', () => {
    fixture.detectChanges();
    let loaderComponent = fixture.debugElement.query(By.directive(LoaderComponent));
    expect(loaderComponent.componentInstance.loading).toBeFalse();

    fixture.componentInstance.isLoading = true;
    flushChanges(fixture);
    loaderComponent = fixture.debugElement.query(By.directive(LoaderComponent));
    expect(loaderComponent.componentInstance.loading).toBeTrue();
  });

  it('should show the blocker element only while loading', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.blocker')).toBeFalsy();

    fixture.componentInstance.isLoading = true;
    flushChanges(fixture);
    expect(fixture.nativeElement.querySelector('.blocker')).toBeTruthy();
  });
});
