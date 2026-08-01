import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  let component: LoaderComponent;
  let fixture: ComponentFixture<LoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default loading to false and not render the blocker', () => {
    expect(component.loading).toBeFalse();
    expect(fixture.debugElement.query(By.css('.blocker'))).toBeFalsy();
  });

  it('should render the blocker when loading is true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.blocker'))).toBeTruthy();
  });

  it('should project content', () => {
    const projectedFixture = TestBed.createComponent(LoaderComponent);
    projectedFixture.nativeElement.innerHTML = '';
    projectedFixture.detectChanges();
    const container = projectedFixture.debugElement.query(By.css('.loading-container'));
    expect(container).toBeTruthy();
  });
});
