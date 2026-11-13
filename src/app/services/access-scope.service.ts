import { Injectable, computed, inject } from '@angular/core';
import { Employee } from '../infrastructure/types/employee';
import { inScope, scopeOf } from '../shared/functions/org';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';

/**
 * For whom the signed-in person may act. Permissions say what they can do;
 * this says to whom: everyone with OrgWideAccess, otherwise only the people
 * in their own reporting line.
 */
@Injectable({ providedIn: 'root' })
export class AccessScope {
  private readonly user = inject(AuthService).currentUser;
  readonly orgWide = inject(PermissionsService).can('OrgWideAccess');
  /** The signed-in person's own People record, if they have one. */
  readonly ownId = computed(() => this.user()?.employeeId);

  /** Ids in scope for this viewer, or null for everyone. Needs the people list to walk reporting lines. */
  of(employees: Pick<Employee, 'id' | 'managerId'>[]): Set<number> | null {
    return scopeOf(employees, { orgWide: this.orgWide(), employeeId: this.ownId() });
  }

  covers(employees: Pick<Employee, 'id' | 'managerId'>[], employeeId: number): boolean {
    return inScope(this.of(employees), employeeId);
  }
}
