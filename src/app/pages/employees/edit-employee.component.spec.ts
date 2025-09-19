import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
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
  };

  const mockPermissionsService = {
    hasPermission: () => of(true)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditEmployeeComponent, NoopAnimationsModule],
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
        },
        {
          provide: IMAGE_LOADER,
          useValue: imageLoader
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

  it('should have a custom image loader', () => {
    const customImageLoader = TestBed.inject(IMAGE_LOADER);
    expect(customImageLoader).toBe(imageLoader);
  });
});
