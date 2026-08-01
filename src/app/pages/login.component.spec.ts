import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  const mockAuthService = {
    login: jasmine.createSpy('login').and.returnValue(of({ token: 'abc' })),
  };

  beforeEach(async () => {
    mockAuthService.login.calls.reset();
    mockAuthService.login.and.returnValue(of({ token: 'abc' }));

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
    })
      .overrideComponent(LoginComponent, {
        set: { providers: [{ provide: AuthService, useValue: mockAuthService }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a warning when email or password is missing', () => {
    const warning = fixture.debugElement.nativeElement.querySelector('.warning');
    expect(warning).toBeTruthy();
  });

  it('should not call authService.login when fields are empty', () => {
    component.submit();
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('should not call authService.login when only email is filled', () => {
    component.credentials.email = 'user@example.com';
    component.submit();
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('should call authService.login with credentials when both fields are filled', () => {
    component.credentials = { email: 'user@example.com', password: 'secret' };
    component.submit();
    expect(mockAuthService.login).toHaveBeenCalledWith(component.credentials);
  });

  it('should hide the warning once both fields are filled', () => {
    component.credentials = { email: 'user@example.com', password: 'secret' };
    fixture.detectChanges();
    const warning = fixture.debugElement.nativeElement.querySelector('.warning');
    expect(warning).toBeFalsy();
  });

  it('should update credentials when the inputs change', () => {
    const emailInput: HTMLInputElement = fixture.debugElement.nativeElement.querySelector('input[name="email"]');
    const passwordInput: HTMLInputElement = fixture.debugElement.nativeElement.querySelector('input[name="password"]');

    emailInput.value = 'typed@example.com';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'typedPassword';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.credentials.email).toBe('typed@example.com');
    expect(component.credentials.password).toBe('typedPassword');
  });
});
