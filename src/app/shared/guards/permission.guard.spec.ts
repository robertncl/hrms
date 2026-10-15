import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { PermissionsService } from 'src/app/services/permissions.service';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  const run = () =>
    firstValueFrom(
      TestBed.runInInjectionContext(
        () => permissionGuard('ManageCourses', '/learning')(null as any, null as any) as Observable<boolean | UrlTree>,
      ),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('should allow users with the permission', async () => {
    TestBed.inject(PermissionsService).setPermissions({ ManageCourses: true });
    expect(await run()).toBeTrue();
  });

  it('should redirect users without the permission', async () => {
    const result = await run();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/learning');
  });
});
