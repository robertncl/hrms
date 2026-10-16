import { TestBed } from '@angular/core/testing';
import { DemoRole, permissionsFor } from 'src/app/demo/demo-data';
import { PermissionsService } from 'src/app/services/permissions.service';

/** Gives the test exactly the permissions a demo role signs in with. */
export function grantRole(role: DemoRole): void {
  TestBed.inject(PermissionsService).replacePermissions(permissionsFor(role));
}
