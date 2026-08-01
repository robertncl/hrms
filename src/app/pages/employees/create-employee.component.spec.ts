import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CreateEmployeeComponent } from './create-employee.component';
import { EmployeeService } from 'src/app/services/employee.service';

describe('CreateEmployeeComponent', () => {
  let component: CreateEmployeeComponent;
  let fixture: ComponentFixture<CreateEmployeeComponent>;

  const mockEmployeeService = {
    createEmployee: jasmine.createSpy('createEmployee'),
  };

  beforeEach(async () => {
    mockEmployeeService.createEmployee.calls.reset();

    await TestBed.configureTestingModule({
      imports: [CreateEmployeeComponent, NoopAnimationsModule],
      providers: [
        { provide: EmployeeService, useValue: mockEmployeeService },
      ],
    }).compileComponents();

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

  it('should call employeeService.createEmployee with the form value when the form is valid', () => {
    component.form.setValue({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      position: 'Developer',
      level: 'Junior',
    });

    component.submit();

    expect(mockEmployeeService.createEmployee).toHaveBeenCalledWith(component.form.value);
  });

  it('should update firstName control when the input value changes', () => {
    const input: HTMLInputElement = fixture.debugElement.nativeElement.querySelector('input');
    input.value = 'Alice';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.form.controls.firstName.value).toBe('Alice');
  });
});
