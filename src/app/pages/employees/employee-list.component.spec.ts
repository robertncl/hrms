import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmationDialogComponent } from 'src/app/shared/components/confirmation-dialog.component';
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
    deleteEmployee: jasmine.createSpy('deleteEmployee').and.returnValue(of({})),
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

  it('should invoke showConfirmationDialog when the delete button is clicked', () => {
    spyOn(component, 'showConfirmationDialog');
    const deleteButton: HTMLButtonElement = fixture.debugElement.nativeElement.querySelector('button');
    deleteButton.click();

    expect(component.showConfirmationDialog).toHaveBeenCalled();
  });

  it('should call showConfirmationDialog directly and set isConfirmationOpen', async () => {
    await component.showConfirmationDialog();

    expect(component.isConfirmationOpen).toBeTrue();
    expect(component.confirmDialog).toBeTruthy();
  });

  const rowNames = () =>
    Array.from(fixture.debugElement.nativeElement.querySelectorAll('tbody tr .person a') as NodeListOf<HTMLElement>)
      .map((a) => a.textContent!.trim());

  it('should filter employees by name or email', () => {
    component.search.set('smith');
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Jane Smith']);
  });

  it('should filter employees by position', () => {
    component.positionFilter.set('Developer');
    fixture.detectChanges();
    expect(rowNames()).toEqual(['John Doe']);
  });

  it('should take the initial position filter from the route', () => {
    fixture.componentRef.setInput('position', 'Designer');
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Jane Smith']);
  });

  it('should show availability as a labelled badge', () => {
    const badges = Array.from(fixture.debugElement.nativeElement.querySelectorAll('tbody .badge') as NodeListOf<HTMLElement>)
      .map((b) => b.textContent!.trim());
    expect(badges).toEqual(['Available', 'On leave']);
  });

  it('should delete the employee and reload the list once confirmed', async () => {
    mockEmployeeService.getEmployees.calls.reset();
    await component.showConfirmationDialog(mockEmployees[0]);
    expect(component.confirmDialog).toBe(ConfirmationDialogComponent);

    (component.confirmInputs['onConfirm'] as () => void)();

    expect(mockEmployeeService.deleteEmployee).toHaveBeenCalledWith(1);
    expect(mockEmployeeService.getEmployees).toHaveBeenCalledTimes(1);
  });

  it('should remove the dialog when it closes', async () => {
    await component.showConfirmationDialog(mockEmployees[0]);
    (component.confirmInputs['onClose'] as () => void)();

    expect(component.isConfirmationOpen).toBeFalse();
    expect(component.confirmDialog).toBeNull();
  });

  it('should render the confirmation dialog without a manual change detection pass', async () => {
    fixture.autoDetectChanges();
    await component.showConfirmationDialog(mockEmployees[0]);
    await fixture.whenStable();

    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('app-confirmation-dialog dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('John Doe will be removed');
  });
});
