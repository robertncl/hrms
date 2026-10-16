import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CreateEmployeeComponent } from './create-employee.component';
import { EmployeeService } from 'src/app/services/employee.service';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { daysFromToday } from 'src/app/demo/demo-data';

describe('CreateEmployeeComponent', () => {
  let component: CreateEmployeeComponent;
  let fixture: ComponentFixture<CreateEmployeeComponent>;
  let navigateSpy: jasmine.Spy;

  const manager: Employee = {
    id: 3, firstName: 'Olivia', lastName: 'Bennett', email: 'olivia.bennett@acme.com',
    position: 'Manager', level: 'Lead', isAvailable: true, profilePicture: '',
  };
  const mockEmployeeService = {
    createEmployee: jasmine.createSpy('createEmployee').and.returnValue(of({ id: 7 })),
    getEmployees: () => of([manager]),
  };
  const basics = {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    position: 'Developer',
    level: 'Junior',
  };

  beforeEach(async () => {
    mockEmployeeService.createEmployee.calls.reset();

    await TestBed.configureTestingModule({
      imports: [CreateEmployeeComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: EmployeeService, useValue: mockEmployeeService },
      ],
    }).compileComponents();

    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(CreateEmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an invalid form because firstName is required', () => {
    expect(component.form.valid).toBeFalse();
    expect(component.form.controls.firstName.hasError('required')).toBeTrue();
  });

  it('should not call employeeService.createEmployee when the form is invalid', () => {
    component.submit();
    expect(mockEmployeeService.createEmployee).not.toHaveBeenCalled();
  });

  it('should send the basics and start date, leaving empty optional fields out', () => {
    component.form.patchValue(basics);

    component.submit();

    expect(mockEmployeeService.createEmployee).toHaveBeenCalledWith({ ...basics, startDate: daysFromToday(0) });
  });

  it('should send the employment and private details when given', () => {
    component.form.patchValue({
      ...basics,
      startDate: '2026-11-02',
      location: 'Lisbon',
      managerId: 3,
      phone: '+44 20 7946 0999',
      personalEmail: 'jane@example.com',
    });

    component.submit();

    expect(mockEmployeeService.createEmployee).toHaveBeenCalledWith({
      ...basics,
      startDate: '2026-11-02',
      location: 'Lisbon',
      managerId: 3,
      phone: '+44 20 7946 0999',
      personalEmail: 'jane@example.com',
    });
  });

  it('should offer everyone as a manager', () => {
    const options = Array.from(fixture.nativeElement.querySelectorAll('#employee-manager option') as NodeListOf<HTMLOptionElement>)
      .map((option) => option.textContent!.trim());
    expect(options).toEqual(['Nobody', 'Olivia Bennett · Manager']);
  });

  it('should reject a malformed phone number or personal email', () => {
    component.form.controls.phone.setValue('call me');
    component.form.controls.personalEmail.setValue('nope');
    expect(component.form.controls.phone.hasError('pattern')).toBeTrue();
    expect(component.form.controls.personalEmail.hasError('email')).toBeTrue();
  });

  it('should update firstName control when the input value changes', () => {
    const input: HTMLInputElement = fixture.debugElement.nativeElement.querySelector('input');
    input.value = 'Alice';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.form.controls.firstName.value).toBe('Alice');
  });

  it('should open the new employee profile after saving', () => {
    component.form.patchValue(basics);
    component.submit();
    expect(navigateSpy).toHaveBeenCalledWith(['/employees/details', 7]);
  });

  it('should show field errors after an invalid submit', () => {
    component.submit();
    fixture.detectChanges();

    const firstName: HTMLInputElement = fixture.nativeElement.querySelector('#employee-first-name');
    expect(firstName.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('First name is required.');
  });

  it('should reject an invalid email address', () => {
    component.form.controls.email.setValue('not-an-email');
    expect(component.form.controls.email.hasError('email')).toBeTrue();
  });

  it('should submit when the form button is clicked', () => {
    spyOn(component, 'submit');
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(component.submit).toHaveBeenCalled();
  });
});
