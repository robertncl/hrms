import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EmployeeListComponent } from './employee-list.component';
import { EmployeeService } from 'src/app/services/employee.service';
import { Employee } from 'src/app/infrastructure/types/employee';
import { imageLoader } from 'src/app/app.config';

describe('EmployeeListComponent', () => {
  let component: EmployeeListComponent;
  let fixture: ComponentFixture<EmployeeListComponent>;

  const mockEmployees: Employee[] = [
    {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      position: 'Developer',
      level: 'Senior',
      isAvailable: true,
      profilePicture: 'john.png',
    },
    {
      id: 2,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      position: 'Designer',
      level: 'Junior',
      isAvailable: false,
      profilePicture: 'jane.png',
    },
  ];

  const mockEmployeeService = {
    getEmployees: jasmine.createSpy('getEmployees').and.returnValue(of(mockEmployees)),
    getEmployee: jasmine.createSpy('getEmployee').and.callFake((id: number) =>
      of(mockEmployees.find((employee) => employee.id === id)),
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeListComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: EmployeeService, useValue: mockEmployeeService },
        { provide: IMAGE_LOADER, useValue: imageLoader },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a row per employee returned by the service', () => {
    const rows = fixture.debugElement.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(mockEmployees.length);
  });

  it('should not show the confirmation dialog initially', () => {
    expect(component.isConfirmationOpen).toBeFalse();
    expect(component.confirmDialog).toBeNull();
  });

  it('should open the confirmation dialog when the delete button is clicked', async () => {
    const deleteButton: HTMLButtonElement = fixture.debugElement.nativeElement.querySelector('button');
    deleteButton.click();
    await fixture.whenStable();

    expect(component.isConfirmationOpen).toBeTrue();
    expect(component.confirmDialog).toBeTruthy();
  });

  it('should call showConfirmationDialog directly and set isConfirmationOpen', async () => {
    await component.showConfirmationDialog();

    expect(component.isConfirmationOpen).toBeTrue();
    expect(component.confirmDialog).toBeTruthy();
  });
});
