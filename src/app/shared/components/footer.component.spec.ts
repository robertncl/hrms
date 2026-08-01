import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FooterComponent } from './footer.component';
import { AuthService } from '../../services/auth.service';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;
  let isAuth$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    isAuth$ = new BehaviorSubject<boolean>(false);
    const mockAuthService = { isAuth$ };

    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the HRMS heading and social links', () => {
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('HRMS');
    const links = fixture.debugElement.queryAll(By.css('.links a'));
    expect(links.length).toBe(2);
  });

  it('should not render legal links when not authenticated', () => {
    expect(fixture.debugElement.query(By.css('.legal'))).toBeFalsy();
  });

  it('should render legal links when authenticated', () => {
    isAuth$.next(true);
    fixture.detectChanges();

    const legal = fixture.debugElement.query(By.css('.legal'));
    expect(legal).toBeTruthy();
    const links = fixture.debugElement.queryAll(By.css('.legal a'));
    expect(links.length).toBe(3);
  });

  it('should hide legal links again after logging out', () => {
    isAuth$.next(true);
    fixture.detectChanges();
    isAuth$.next(false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.legal'))).toBeFalsy();
  });
});
