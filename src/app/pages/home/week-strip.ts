import { Employee } from 'src/app/infrastructure/types/employee';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';

/** One absence bar laid across the Mon-Fri strip. */
export type WeekBar = {
  id: number;
  name: string;
  label: string;
  /** CSS grid-column spanning the working days the absence covers. */
  column: string;
  pending: boolean;
};

const DAY = 86_400_000;
const WORKING_DAYS = 5;

export function nextWeekDays(): string[] {
  return ['MON', 'TUE', 'WED', 'THU', 'FRI'];
}

/** Midnight on the Monday of next week. */
export function nextMonday(today = new Date()): Date {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (8 - base.getDay()) % 7 || 7;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
}

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "19–23 Oct", or "28 Sep – 2 Oct" when the week straddles two months. */
export function nextWeekRange(today = new Date()): string {
  const monday = nextMonday(today);
  const friday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const sameMonth = monday.getMonth() === friday.getMonth();
  return sameMonth
    ? `${monday.getDate()}–${friday.toLocaleDateString('en-GB', opts)}`
    : `${monday.toLocaleDateString('en-GB', opts)} – ${friday.toLocaleDateString('en-GB', opts)}`;
}

/**
 * Absences that touch next week's working days, as grid-positioned bars.
 *
 * Column 1 holds the name, so a bar starting on Monday begins at column 2 —
 * hence the +2 / +3 offsets below.
 */
export function nextWeekBars(
  requests: TimeOffRequest[],
  employees: Employee[],
  today = new Date(),
): WeekBar[] {
  const names = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const monday = nextMonday(today);
  const mondayMs = monday.getTime();
  const weekStart = iso(monday);
  const weekEnd = iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4));

  return requests
    .filter(
      (request) =>
        request.status !== 'Rejected' &&
        request.startDate <= weekEnd &&
        request.endDate >= weekStart,
    )
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((request) => {
      const start = new Date(`${request.startDate}T00:00:00`).getTime();
      const end = new Date(`${request.endDate}T00:00:00`).getTime();
      const startDay = Math.max(0, Math.round((start - mondayMs) / DAY));
      const endDay = Math.min(WORKING_DAYS - 1, Math.round((end - mondayMs) / DAY));
      const pending = request.status === 'Pending';

      return {
        id: request.id,
        name: names.get(request.employeeId) ?? `Employee #${request.employeeId}`,
        label: pending ? 'Pending' : request.type,
        column: `${startDay + 2} / ${endDay + 3}`,
        pending,
      };
    });
}
