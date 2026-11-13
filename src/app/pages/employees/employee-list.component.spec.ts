import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IMAGE_LOADER } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmationDialogComponent } from 'src/app/shared/components/confirmation-dialog.component';
import { EmployeeListComponent } from './employee-list.component';
import { EmployeeService } from 'src/app/services/employee.service';
import { ProjectService } from 'src/app/services/project.service';
import { TimeOffRequestService } from 'src/app/services/time-off-request.service';
import { Employee } from 'src/app/infrastructure/types/employee';
import { imageLoader } from 'src/app/app.config';
import { grantRole } from 'src/testing/roles';
import { DemoRole } from 'src/app/demo/demo-data';
import { signal } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/infrastructure/types/user';

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
      department: 'Engineering',
      jobTitle: 'Staff Engineer',
      managerId: 7,
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
      department: 'Design',
    },
  ];

  const currentUser = signal<User | null>(null);
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
        {
          provide: ProjectService,
          useValue: {
            getProjects: () => of([
              { id: 1, name: 'Hadron', description: '', image: '', employees: [1], subProjectIds: [] },
            ]),
          },
        },
        {
          provide: TimeOffRequestService,
          useValue: {
            getRequests: () => of([
              // Jane is signed off across today, so her row says why.
              { id: 1, employeeId: 2, startDate: '2000-01-01', endDate: '2099-12-31', type: 'Vacation', status: 'Approved' },
            ]),
          },
        },
        { provide: IMAGE_LOADER, useValue: imageLoader },
        { provide: AuthService, useValue: { currentUser } },
      ],
    }).compileComponents();

    render('HR Administrator');
  });

  const render = (role: DemoRole, employeeId?: number) => {
    grantRole(role);
    currentUser.set({ name: 'Test', email: '', role, ...(employeeId ? { employeeId } : {}) });
    fixture = TestBed.createComponent(EmployeeListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as HTMLElement;

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

  it('should invoke showConfirmationDialog when the remove button is clicked', () => {
    spyOn(component, 'showConfirmationDialog');
    const removeButton: HTMLButtonElement =
      fixture.debugElement.nativeElement.querySelector('tbody td.actions button');
    removeButton.click();

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

  it('should filter employees by department', () => {
    const select = el().querySelector('#employee-department') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent!.trim()))
      .toEqual(['All departments', 'Engineering', 'Design', 'Quality', 'Delivery']);

    select.value = 'Design';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Jane Smith']);
  });

  it('should take the initial department filter from the route', () => {
    fixture.componentRef.setInput('department', 'Engineering');
    fixture.detectChanges();
    expect(rowNames()).toEqual(['John Doe']);
    // The picker has to show the filter that is in force.
    expect((el().querySelector('#employee-department') as HTMLSelectElement).value).toBe('Engineering');
  });

  it('should find people by job title or department', () => {
    component.search.set('staff eng');
    fixture.detectChanges();
    expect(rowNames()).toEqual(['John Doe']);

    component.search.set('design');
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Jane Smith']);
  });

  it('should show the job title and department, falling back to the role', () => {
    const cell = (row: number, label: string) =>
      (el().querySelectorAll('tbody tr')[row].querySelector(`td[data-label="${label}"]`) as HTMLElement).textContent!.trim();

    expect(cell(0, 'Role')).toBe('Staff Engineer');
    expect(cell(0, 'Department')).toBe('Engineering');
    expect(cell(1, 'Role')).toBe('Designer');
  });

  it('should take the initial position filter from the route', () => {
    fixture.componentRef.setInput('position', 'Designer');
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Jane Smith']);
  });

  it('should show availability as a labelled status badge, never colour alone', () => {
    const badges = Array.from(
      fixture.debugElement.nativeElement.querySelectorAll('tbody .status-badge') as NodeListOf<HTMLElement>,
    );
    expect(badges.map((s) => s.textContent!.trim())).toEqual(['In today', 'Vacation until 31 Dec']);
    // Away takes the info set and its glyph; "In today" stays neutral.
    expect(badges[0].classList).not.toContain('badge-info');
    expect(badges[1].classList).toContain('badge-info');
    expect(badges[1].querySelector('app-status-icon svg')).not.toBeNull();
  });

  it('should filter by role from the tabs', () => {
    const tabs = Array.from(
      fixture.debugElement.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>,
    );
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    tabs.find((t) => t.textContent!.includes('Designers'))!.click();
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Jane Smith']);
  });

  it('should list the projects somebody is on', () => {
    const cells = fixture.debugElement.nativeElement.querySelectorAll('tbody .projects');
    expect(cells[0].textContent.trim()).toBe('Hadron');
    expect(cells[1].textContent.trim()).toBe('—');
  });

  it('should filter to only the people who are away', () => {
    component.setAwayOnly(true);
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Jane Smith']);
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
    expect(dialog.textContent).toContain('Remove John Doe?');
    expect(dialog.textContent).toContain("You can't undo it");
  });

  describe('by role', () => {
    const rowControls = () => Array.from(el().querySelectorAll('tbody tr:first-child td.actions .visually-hidden'))
      .map((label) => label.textContent!.split(' ')[0]);

    it('should give HR every control', () => {
      expect(el().textContent).toContain('Add person');
      expect(rowControls()).toEqual(['Edit', 'Remove']);
    });

    it('should let a team lead edit their own reports, but not add or remove people', () => {
      render('Team Lead', 7);
      expect(el().querySelector('a[href="/employees/create"]')).toBeNull();
      // John reports to lead 7; Jane doesn't.
      expect(rowControls()).toEqual(['Edit']);
      expect(el().querySelectorAll('tbody tr:nth-child(2) td.actions a').length).toBe(0);
    });

    it("should not offer a lead Edit for people on another team", () => {
      render('Team Lead', 3);
      expect(rowControls()).toEqual([]);
    });

    it('should let a recruiter add people but not edit or remove them', () => {
      render('Recruiter');
      expect(el().querySelector('a[href="/employees/create"]')).not.toBeNull();
      expect(rowControls()).toEqual([]);
    });

    it('should leave an employee with a read-only directory they can still export', () => {
      render('Employee');
      expect(el().querySelector('a[href="/employees/create"]')).toBeNull();
      expect(rowControls()).toEqual([]);
      expect(el().textContent).toContain('Export CSV');
    });
  });
});
