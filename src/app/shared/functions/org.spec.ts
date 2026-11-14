import { inScope, reportingLine, scopeOf } from './org';

describe('org', () => {
  // 1 ← 2, 3;  3 ← 4;  5 has no manager;  6 ← 5
  const employees = [
    { id: 1 },
    { id: 2, managerId: 1 },
    { id: 3, managerId: 1 },
    { id: 4, managerId: 3 },
    { id: 5, managerId: null },
    { id: 6, managerId: 5 },
  ];

  it('should collect direct and indirect reports', () => {
    expect([...reportingLine(employees, 1)].sort()).toEqual([2, 3, 4]);
    expect([...reportingLine(employees, 3)]).toEqual([4]);
    expect(reportingLine(employees, 4).size).toBe(0);
  });

  it('should survive a reporting loop without including the manager', () => {
    const loop = [{ id: 1, managerId: 2 }, { id: 2, managerId: 1 }, { id: 3, managerId: 2 }];
    expect([...reportingLine(loop, 1)].sort()).toEqual([2, 3]);
  });

  it('should give org-wide viewers everyone and others only their line', () => {
    expect(scopeOf(employees, { orgWide: true })).toBeNull();
    expect([...scopeOf(employees, { orgWide: false, employeeId: 5 })!]).toEqual([6]);
    expect(scopeOf(employees, { orgWide: false })!.size).toBe(0);
  });

  it('should never put a person in their own scope', () => {
    const scope = scopeOf(employees, { orgWide: false, employeeId: 1 });
    expect(inScope(scope, 1)).toBeFalse();
    expect(inScope(scope, 4)).toBeTrue();
    expect(inScope(null, 1)).toBeTrue();
  });
});
