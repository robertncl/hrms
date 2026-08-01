import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { EmployeeNotAvailableDirective } from './employee-not-available.directive';
import { EmployeeService } from 'src/app/services/employee.service';
import { Employee } from 'src/app/infrastructure/types/employee';

const mockEmployee: Employee = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  position: 'Developer',
  level: 'Senior',
  isAvailable: false,
  profilePicture: '',
};

@Component({
  standalone: true,
  imports: [RouterLink, EmployeeNotAvailableDirective],
  template: `<a routerLink="/employees/details/1">John Doe</a>`,
})
class HostComponent {}

@Component({
  standalone: true,
  imports: [RouterLink, EmployeeNotAvailableDirective],
  template: `<a routerLink="/employees">Employees</a>`,
})
class OtherRouteHostComponent {}

describe('EmployeeNotAvailableDirective', () => {
  it('should mark the link as not-available and set a tooltip when the employee is unavailable', async () => {
    const mockEmployeeService = {
      getEmployee: jasmine.createSpy('getEmployee').and.returnValue(of(mockEmployee)),
    };

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        { provide: EmployeeService, useValue: mockEmployeeService },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockEmployeeService.getEmployee).toHaveBeenCalledWith(1);
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.classList.contains('not-available')).toBeTrue();
    expect(link.getAttribute('title')).toBe('Employee is not available');
  });

  it('should not mark the link as not-available when the employee is available', async () => {
    const mockEmployeeService = {
      getEmployee: jasmine.createSpy('getEmployee').and.returnValue(of({ ...mockEmployee, isAvailable: true })),
    };

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        { provide: EmployeeService, useValue: mockEmployeeService },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.classList.contains('not-available')).toBeFalse();
    expect(link.getAttribute('title')).toBe('');
  });

  it('should not call the employee service when the link does not point to employee details', async () => {
    const mockEmployeeService = {
      getEmployee: jasmine.createSpy('getEmployee').and.returnValue(of(mockEmployee)),
    };

    await TestBed.configureTestingModule({
      imports: [OtherRouteHostComponent],
      providers: [
        provideRouter([]),
        { provide: EmployeeService, useValue: mockEmployeeService },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<OtherRouteHostComponent> = TestBed.createComponent(OtherRouteHostComponent);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(mockEmployeeService.getEmployee).not.toHaveBeenCalled();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.classList.contains('not-available')).toBeFalse();
  });
});
