import { Employee } from 'src/app/infrastructure/types/employee';
import { Project } from 'src/app/infrastructure/types/project';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';

/** Project names per employee id, joined for the Projects column. */
export function employeeProjectNames(projects: Project[]): Record<number, string> {
  const byEmployee = new Map<number, string[]>();
  for (const project of projects) {
    for (const employeeId of project.employees) {
      const names = byEmployee.get(employeeId) ?? [];
      names.push(project.name);
      byEmployee.set(employeeId, names);
    }
  }
  return Object.fromEntries([...byEmployee].map(([id, names]) => [id, names.join(', ')]));
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * "Vacation until 20 Oct" for anyone with an approved absence covering today,
 * so the list says why somebody is away rather than just that they are.
 */
export function awayLabels(requests: TimeOffRequest[], today = new Date()): Record<number, string> {
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const iso = `${today.getFullYear()}-${month}-${day}`;

  const labels: Record<number, string> = {};
  for (const request of requests) {
    if (request.status !== 'Approved') continue;
    if (request.startDate > iso || request.endDate < iso) continue;
    labels[request.employeeId] = `${request.type} until ${formatDay(request.endDate)}`;
  }
  return labels;
}

function csvCell(value: string): string {
  // Quote anything that could otherwise break the row apart.
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The visible table as CSV, in the same order and with the same columns. */
export function toCsv(
  employees: Employee[],
  projectNames: Record<number, string>,
  statusLabel: (employee: Employee) => string,
): string {
  const header = ['Name', 'Email', 'Role', 'Level', 'Status', 'Projects'];
  const rows = employees.map((employee) =>
    [
      `${employee.firstName} ${employee.lastName}`,
      employee.email,
      employee.position,
      employee.level,
      statusLabel(employee),
      projectNames[employee.id] ?? '',
    ].map(csvCell).join(','),
  );
  return [header.join(','), ...rows].join('\r\n');
}
