import { Employee } from 'src/app/infrastructure/types/employee';

type Reporting = Pick<Employee, 'id' | 'managerId'>;

/** Everyone below `managerId` in the reporting line: direct reports and theirs, all the way down. */
export function reportingLine(employees: Reporting[], managerId: number): Set<number> {
  const reports = new Map<number, number[]>();
  for (const { id, managerId: manager } of employees) {
    if (manager != null) reports.set(manager, [...(reports.get(manager) ?? []), id]);
  }
  const line = new Set<number>();
  const queue = [...(reports.get(managerId) ?? [])];
  while (queue.length) {
    const id = queue.pop()!;
    // The seen-check also stops a reporting loop (A → B → A) from spinning forever.
    if (id === managerId || line.has(id)) continue;
    line.add(id);
    queue.push(...(reports.get(id) ?? []));
  }
  return line;
}

/** Who is acting: org-wide roles reach everyone, the rest only their own reporting line. */
export type Viewer = { orgWide: boolean; employeeId?: number };

/**
 * The people a viewer may act on (approve leave for, edit, assign training to).
 * `null` means everyone. A person is never in their own scope: nobody approves
 * their own leave.
 */
export function scopeOf(employees: Reporting[], viewer: Viewer): Set<number> | null {
  if (viewer.orgWide) return null;
  return viewer.employeeId === undefined ? new Set() : reportingLine(employees, viewer.employeeId);
}

export function inScope(scope: Set<number> | null, employeeId: number): boolean {
  return scope === null || scope.has(employeeId);
}
