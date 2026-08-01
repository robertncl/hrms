import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { EmployeeService } from './employee.service';
import { Employee } from '../infrastructure/types/employee';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let httpMock: HttpTestingController;

  const mockEmployee: Employee = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    position: 'Developer',
    level: 'Senior',
    isAvailable: true,
    profilePicture: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EmployeeService],
    });

    service = TestBed.inject(EmployeeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all employees', () => {
    service.getEmployees().subscribe((employees) => {
      expect(employees).toEqual([mockEmployee]);
    });

    const req = httpMock.expectOne('/employees');
    expect(req.request.method).toBe('GET');
    req.flush([mockEmployee]);
  });

  it('should fetch a single employee by id', () => {
    service.getEmployee(1).subscribe((employee) => {
      expect(employee).toEqual(mockEmployee);
    });

    const req = httpMock.expectOne('/employees/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockEmployee);
  });

  it('should create an employee', () => {
    const { id, isAvailable, ...newEmployee } = mockEmployee;

    service.createEmployee(newEmployee).subscribe();

    const req = httpMock.expectOne('/employees');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newEmployee);
    req.flush(mockEmployee);
  });
});
