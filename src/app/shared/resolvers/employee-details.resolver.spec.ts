import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { Employee } from 'src/app/infrastructure/types/employee';
import { EmployeeService } from 'src/app/services/employee.service';
import { employeeDetailsResolver } from './employee-details.resolver';

describe('employeeDetailsResolver', () => {
  let mockEmployeeService: { getEmployee: jasmine.Spy };

  const mockEmployee: Employee = {
    id: 7,
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    position: 'Developer',
    level: 'Senior',
    isAvailable: true,
    profilePicture: '',
  };

  const buildSnapshot = (id: string | null): ActivatedRouteSnapshot =>
    ({ paramMap: { get: () => id } } as unknown as ActivatedRouteSnapshot);

  beforeEach(() => {
    mockEmployeeService = { getEmployee: jasmine.createSpy('getEmployee').and.returnValue(of(mockEmployee)) };

    TestBed.configureTestingModule({
      providers: [{ provide: EmployeeService, useValue: mockEmployeeService }],
    });
  });

  it('should call EmployeeService.getEmployee with the numeric id from the route', (done) => {
    TestBed.runInInjectionContext(() => {
      const result = employeeDetailsResolver(buildSnapshot('7'), null as any);
      (result as Observable<Employee>).subscribe((employee) => {
        expect(mockEmployeeService.getEmployee).toHaveBeenCalledWith(7);
        expect(employee).toEqual(mockEmployee);
        done();
      });
    });
  });

  it('should default to id 0 when the route has no id param', () => {
    TestBed.runInInjectionContext(() => {
      employeeDetailsResolver(buildSnapshot(null), null as any);
    });

    expect(mockEmployeeService.getEmployee).toHaveBeenCalledWith(0);
  });
});
