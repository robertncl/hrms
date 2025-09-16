import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { EditEmployeeComponent } from './edit-employee.component';
import { Employee } from 'src/app/infrastructure/types/employee';
import { PermissionsService } from 'src/app/services/permissions.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';

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
    profilePicture: ''
  };

  const mockPermissionsService = {
    hasPermission: () => of(true)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditEmployeeComponent, NoopAnimationsModule, HttpClientTestingModule],
      providers: [
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
        }
      ]
    })
    .compileComponents();

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
});
