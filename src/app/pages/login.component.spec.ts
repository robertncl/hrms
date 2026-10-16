import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';
import { DEMO_ACCOUNTS } from '../demo/demo-data';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let navigateSpy: jasmine.Spy;

  const mockAuthService = {
    isAuth$: new BehaviorSubject(false),
    login: jasmine.createSpy('login').and.returnValue(of({ token: 'abc' })),
  };

  beforeEach(async () => {
    mockAuthService.login.calls.reset();
    mockAuthService.login.and.returnValue(of({ token: 'abc' }));

    await TestBed.configureTestingModule({
      imports: [LoginComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    })
      .overrideComponent(LoginComponent, {
        set: { providers: [{ provide: AuthService, useValue: mockAuthService }] },
      })
      .compileComponents();

    navigateSpy = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should keep the submit button disabled while a field is empty', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBeTrue();
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

  it('should enable the submit button once both fields are filled', () => {
    component.credentials = { email: 'user@example.com', password: 'secret' };
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBeFalse();
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

  it('should go to the dashboard after signing in', () => {
    component.credentials = { email: 'user@example.com', password: 'secret' };
    component.submit();
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('should show the error message when signing in fails', () => {
    mockAuthService.login.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 401, error: { message: 'Invalid email or password' },
    })));
    component.credentials = { email: 'user@example.com', password: 'wrong' };
    component.submit();
    fixture.detectChanges();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Invalid email or password');
  });

  it('should fill in a demo account', () => {
    component.useAccount('admin@acme.com');
    expect(component.credentials).toEqual({ email: 'admin@acme.com', password: 'demo' });
  });

  it('should submit when the sign-in button is clicked', () => {
    // The button only accepts a click once both fields are filled.
    component.credentials = { email: 'user@example.com', password: 'secret' };
    fixture.detectChanges();
    spyOn(component, 'submit');
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(component.submit).toHaveBeenCalled();
  });

  it('should list every demo account with its role and what it can do', () => {
    const accounts = Array.from(fixture.nativeElement.querySelectorAll('.demo button.use') as NodeListOf<HTMLButtonElement>);
    expect(accounts.map((b) => b.querySelector('.email')!.textContent!.trim())).toEqual(DEMO_ACCOUNTS.map((a) => a.email));
    expect(accounts.map((b) => b.querySelector('.role')!.textContent!.replace(/\s+/g, ' ').trim())).toEqual(
      DEMO_ACCOUNTS.map((a) => `${a.role} · ${a.name}`),
    );
    expect(accounts[4].querySelector('.summary')!.textContent).toContain('her own time off');
  });

  it('should fill in an account when it is picked and mark it as chosen', () => {
    const lead = Array.from(fixture.nativeElement.querySelectorAll('.demo button.use') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent!.includes('lead@acme.com'))!;
    lead.click();
    fixture.detectChanges();

    expect(component.credentials).toEqual({ email: 'lead@acme.com', password: 'demo' });
    expect(lead.getAttribute('aria-pressed')).toBe('true');
  });
});
