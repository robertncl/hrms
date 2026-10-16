import { Employee } from 'src/app/infrastructure/types/employee';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { DAY_MS, midnight, parseDay, toIso } from 'src/app/shared/functions/absence';

/** The timeline covers six weeks from the Monday of the current week. */
export const TIMELINE_WEEKS = 6;
export const TIMELINE_DAYS = TIMELINE_WEEKS * 7;

export type TimelineWeek = { label: string; column: string };

export type TimelineBar = {
  id: number;
  name: string;
  label: string;
  /** CSS grid-column across the day columns the absence covers. */
  column: string;
  pending: boolean;
  /** True when the absence runs past the right-hand edge of the window. */
  continues: boolean;
};

/** Midnight on the Monday of the week containing `today`. */
export function weekStart(today = new Date()): Date {
  const base = midnight(today);
  // getDay() is 0 for Sunday, which belongs to the week that began 6 days ago.
  const back = (base.getDay() + 6) % 7;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - back);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Week header cells, each spanning its seven day columns. */
export function timelineWeeks(today = new Date()): TimelineWeek[] {
  const start = weekStart(today);
  return Array.from({ length: TIMELINE_WEEKS }, (_, i) => ({
    label: addDays(start, i * 7)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      .toUpperCase(),
    // Column 1 holds the name, so week 0 starts at column 2.
    column: `${i * 7 + 2} / span 7`,
  }));
}

/** Where today sits across the window, as a 0-1 fraction of the day columns. */
export function todayFraction(today = new Date()): number {
  const offset = Math.round((midnight(today).getTime() - weekStart(today).getTime()) / DAY_MS);
  // Centre the marker in today's column.
  return (offset + 0.5) / TIMELINE_DAYS;
}

/**
 * Absences touching the six-week window, as grid-positioned bars. Bars are
 * clipped to the window; `continues` says the absence runs on past the edge so
 * the label can say so instead of implying it ends there.
 */
export function timelineBars(
  requests: TimeOffRequest[],
  employees: Employee[],
  today = new Date(),
): TimelineBar[] {
  const names = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const start = weekStart(today);
  const startMs = start.getTime();
  const windowStart = toIso(start);
  const windowEnd = toIso(addDays(start, TIMELINE_DAYS - 1));

  return requests
    .filter(
      (request) =>
        request.status !== 'Rejected' &&
        request.startDate <= windowEnd &&
        request.endDate >= windowStart,
    )
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((request) => {
      const startDay = Math.max(0, Math.round((parseDay(request.startDate) - startMs) / DAY_MS));
      const rawEndDay = Math.round((parseDay(request.endDate) - startMs) / DAY_MS);
      const endDay = Math.min(TIMELINE_DAYS - 1, rawEndDay);
      const continues = rawEndDay > TIMELINE_DAYS - 1;
      const pending = request.status === 'Pending';

      const label = pending
        ? 'Pending'
        : continues
          ? `${request.type} · until ${new Date(`${request.endDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
          : request.type;

      return {
        id: request.id,
        name: names.get(request.employeeId) ?? `Employee #${request.employeeId}`,
        label,
        column: `${startDay + 2} / ${endDay + 3}`,
        pending,
        continues,
      };
    });
}
