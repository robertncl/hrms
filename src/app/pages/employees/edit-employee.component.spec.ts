import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { EmployeeService } from 'src/app/services/employee.service';
import { of } from 'rxjs';
import { EditEmployeeComponent } from './edit-employee.component';
import { Employee } from 'src/app/infrastructure/types/employee';
import { PermissionsService } from 'src/app/services/permissions.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { imageLoader } from 'src/app/app.config';

describe('EditEmployeeComponent', () => {
  let component: EditEmployeeComponent;
  let fixture: ComponentFixture<EditEmployeeComponent>;

  const mockEmployee: Employee = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    position: 'Developer',
    level: 'Senior',
    isAvailable: true,
    profilePicture: '',
    startDate: '2024-02-01',
    location: 'Berlin',
    managerId: 2,
    phone: '+44 20 7946 0101',
    personalEmail: 'john@example.com',
  };
  const manager: Employee = {
    ...mockEmployee, id: 2, firstName: 'Olivia', lastName: 'Bennett', position: 'Manager', level: 'Lead', managerId: undefined,
  };

  let canEditPrivate = true;
  const mockPermissionsService = {
    hasPermission: () => of(canEditPrivate)
  };
  const mockEmployeeService = {
    updateEmployee: jasmine.createSpy('updateEmployee').and.returnValue(of(mockEmployee)),
    getEmployees: () => of([mockEmployee, manager]),
  };
  let navigateSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditEmployeeComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: EmployeeService, useValue: mockEmployeeService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                employee: mockEmployee
              }
            }
          }
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService
        },
        {
          provide: IMAGE_LOADER,
          useValue: imageLoader
        }
      ]
    })
    .compileComponents();

    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    mockEmployeeService.updateEmployee.calls.reset();
    fixture = TestBed.createComponent(EditEmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load employee data from the route resolver', () => {
    expect(component.form.value.firstName).toBe(mockEmployee.firstName);
    expect(component.form.value.lastName).toBe(mockEmployee.lastName);
    expect(component.form.value.email).toBe(mockEmployee.email);
    expect(component.form.value.position).toBe(mockEmployee.position);
    expect(component.form.value.level).toBe(mockEmployee.level);
  });

  it('should have a custom image loader', () => {
    const customImageLoader = TestBed.inject(IMAGE_LOADER);
    expect(customImageLoader).toBe(imageLoader);
  });

  it('should save the changes and return to the profile', () => {
    component.form.controls.level.setValue('Lead');
    component.submit();

    expect(mockEmployeeService.updateEmployee).toHaveBeenCalledWith(1, jasmine.objectContaining({ level: 'Lead' }));
    expect(navigateSpy).toHaveBeenCalledWith(['/employees/details', 1]);
  });

  it('should lock private details and leave them out of the update without permission', () => {
    canEditPrivate = false;
    fixture = TestBed.createComponent(EditEmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    for (const name of ['firstName', 'lastName', 'email', 'phone', 'personalEmail'] as const) {
      expect(component.form.controls[name].disabled).withContext(name).toBeTrue();
    }
    // Employment details stay editable.
    expect(component.form.controls.location.enabled).toBeTrue();
    expect(component.form.controls.managerId.enabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('private details');

    component.form.controls.location.setValue('Lisbon');
    component.submit();
    const changes = mockEmployeeService.updateEmployee.calls.mostRecent().args[1];
    expect(changes.firstName).toBeUndefined();
    expect(changes.phone).toBeUndefined();
    expect(changes.personalEmail).toBeUndefined();
    expect(changes.position).toBe('Developer');
    expect(changes.location).toBe('Lisbon');
    canEditPrivate = true;
  });

  it('should load the employment and private details', () => {
    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining({
      startDate: '2024-02-01',
      location: 'Berlin',
      managerId: 2,
      phone: '+44 20 7946 0101',
      personalEmail: 'john@example.com',
    }));
  });

  it('should not offer the person as their own manager', () => {
    const options = Array.from(fixture.nativeElement.querySelectorAll('#employee-manager option') as NodeListOf<HTMLOptionElement>)
      .map((option) => option.textContent!.trim());
    expect(options).toEqual(['Nobody', 'Olivia Bennett · Manager']);
  });

  it('should clear the manager when "Nobody" is chosen', () => {
    component.form.controls.managerId.setValue(null);
    component.submit();
    expect(mockEmployeeService.updateEmployee.calls.mostRecent().args[1].managerId).toBeNull();
  });

  it('should submit when the form button is clicked', () => {
    spyOn(component, 'submit');
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    expect(component.submit).toHaveBeenCalled();
  });
});
