import { TestBed } from '@angular/core/testing';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PermissionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit false for permissions that have not been set', (done) => {
    service.hasPermission('ViewEmployees').subscribe((value) => {
      expect(value).toBe(false);
      done();
    });
  });

  it('should emit true after a permission is set', (done) => {
    service.setPermissions({ ViewEmployees: true });

    service.hasPermission('ViewEmployees').subscribe((value) => {
      expect(value).toBe(true);
      done();
    });
  });

  it('should merge new permissions with existing ones', (done) => {
    service.setPermissions({ ViewEmployees: true });
    service.setPermissions({ CreateEmployee: true });

    service.hasPermissions(['ViewEmployees', 'CreateEmployee']).subscribe((value) => {
      expect(value).toBe(true);
      done();
    });
  });

  it('should return false from hasPermissions if any permission is missing', (done) => {
    service.setPermissions({ ViewEmployees: true });

    service.hasPermissions(['ViewEmployees', 'CreateEmployee']).subscribe((value) => {
      expect(value).toBe(false);
      done();
    });
  });

  it('should revoke a permission', (done) => {
    service.setPermissions({ ViewEmployees: true });
    service.revokePermission('ViewEmployees');

    service.hasPermission('ViewEmployees').subscribe((value) => {
      expect(value).toBe(false);
      done();
    });
  });

  it('should not affect other permissions when revoking one', (done) => {
    service.setPermissions({ ViewEmployees: true, CreateEmployee: true });
    service.revokePermission('ViewEmployees');

    service.hasPermission('CreateEmployee').subscribe((value) => {
      expect(value).toBe(true);
      done();
    });
  });

  it('should expose a permission as a signal that follows changes', () => {
    const canDelete = service.can('DeleteEmployee');
    expect(canDelete()).toBeFalse();

    service.setPermissions({ DeleteEmployee: true });
    expect(canDelete()).toBeTrue();

    service.clearPermissions();
    expect(canDelete()).toBeFalse();
  });

  it('should replace the whole set rather than merge', (done) => {
    service.setPermissions({ ViewEmployees: true, ManageCourses: true });
    service.replacePermissions({ ViewEmployees: true });

    expect(service.can('ManageCourses')()).toBeFalse();
    service.hasPermission('ManageCourses').subscribe((value) => {
      expect(value).toBeFalse();
      done();
    });
  });
});
