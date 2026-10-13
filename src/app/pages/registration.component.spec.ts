import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RegistrationComponent } from './registration.component';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

describe('RegistrationComponent', () => {
  let component: RegistrationComponent;
  let fixture: ComponentFixture<RegistrationComponent>;
  let mockAuthService: { isAuth$: BehaviorSubject<boolean>; register: jasmine.Spy; login: jasmine.Spy };
  let navigateSpy: jasmine.Spy;

  beforeEach(async () => {
    mockAuthService = {
      isAuth$: new BehaviorSubject(false),
      register: jasmine.createSpy('register').and.returnValue(of({})),
      login: jasmine.createSpy('login').and.returnValue(of({ token: 'abc' })),
    };
    await TestBed.configureTestingModule({
      imports: [RegistrationComponent, NoopAnimationsModule],
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    navigateSpy = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not report a mismatch when confirmPassword is empty', () => {
    component.credentials = { email: '', password: 'secret', confirmPassword: '' };
    expect(component.passwordMismatch).toBeFalse();
  });

  it('should report a mismatch when passwords differ', () => {
    component.credentials = { email: '', password: 'secret', confirmPassword: 'different' };
    expect(component.passwordMismatch).toBeTrue();
  });

  it('should not report a mismatch when passwords match', () => {
    component.credentials = { email: '', password: 'secret', confirmPassword: 'secret' };
    expect(component.passwordMismatch).toBeFalse();
  });

  it('should show an error message in the template when passwords mismatch', () => {
    component.credentials = { email: 'a@b.com', password: 'secret', confirmPassword: 'different' };
    fixture.detectChanges();
    const error = fixture.debugElement.nativeElement.querySelector('.error');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('Passwords do not match');
  });

  it('should not show an error message when passwords match', () => {
    component.credentials = { email: 'a@b.com', password: 'secret', confirmPassword: 'secret' };
    fixture.detectChanges();
    const error = fixture.debugElement.nativeElement.querySelector('.error');
    expect(error).toBeFalsy();
  });

  it('should not throw when submit is called with valid matching credentials', () => {
    component.credentials = { email: 'a@b.com', password: 'secret', confirmPassword: 'secret' };
    expect(() => component.submit()).not.toThrow();
  });

  it('should update credentials when the inputs change', () => {
    const emailInput: HTMLInputElement = fixture.debugElement.nativeElement.querySelector('input[name="email"]');
    const passwordInput: HTMLInputElement = fixture.debugElement.nativeElement.querySelector('input[name="password"]');
    const confirmInput: HTMLInputElement = fixture.debugElement.nativeElement.querySelector('input[name="confirmPassword"]');

    emailInput.value = 'typed@example.com';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'typedPassword';
    passwordInput.dispatchEvent(new Event('input'));
    confirmInput.value = 'typedPassword';
    confirmInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.credentials.email).toBe('typed@example.com');
    expect(component.credentials.password).toBe('typedPassword');
    expect(component.credentials.confirmPassword).toBe('typedPassword');
  });

  it('should register, sign in and go to the dashboard', () => {
    component.credentials = { email: 'a@b.com', password: 'secret', confirmPassword: 'secret' };
    component.submit();

    expect(mockAuthService.register).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
    expect(mockAuthService.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('should not register when the passwords differ', () => {
    component.credentials = { email: 'a@b.com', password: 'secret', confirmPassword: 'other' };
    component.submit();
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });
});
