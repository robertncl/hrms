import { Employee } from 'src/app/infrastructure/types/employee';
import { Project } from 'src/app/infrastructure/types/project';

export type TeamMember = {
  id: number;
  name: string;
  role: string;
  away: boolean;
};

export type StaffedProject = Project & {
  team: TeamMember[];
  awayCount: number;
  /** "5 people · 2 away", or "· all in" when nobody is out. */
  staffing: string;
  subProjectNames: string[];
};

/**
 * A project with its team resolved and its cover summarised, so both the
 * Projects list and a project's own page read staffing the same way.
 */
export function projectStaffing(
  project: Project,
  projects: Project[],
  employees: Employee[],
): StaffedProject {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const team: TeamMember[] = project.employees.flatMap((id) => {
    const employee = byId.get(id);
    return employee
      ? [{
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          role: `${employee.position} · ${employee.level}`,
          away: !employee.isAvailable,
        }]
      : [];
  });

  const awayCount = team.filter((member) => member.away).length;
  const people = `${team.length} ${team.length === 1 ? 'person' : 'people'}`;

  const names = new Map(projects.map((p) => [p.id, p.name]));

  return {
    ...project,
    team,
    awayCount,
    staffing: awayCount ? `${people} · ${awayCount} away` : `${people} · all in`,
    subProjectNames: project.subProjectIds.flatMap((id) => {
      const name = names.get(id);
      return name ? [name] : [];
    }),
  };
}
