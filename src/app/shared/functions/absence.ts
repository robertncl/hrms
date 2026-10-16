import { Employee } from 'src/app/infrastructure/types/employee';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';

export const DAY_MS = 86_400_000;

/** Midnight local time for an ISO (yyyy-mm-dd) date. */
export function parseDay(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

export function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function midnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dayCount(request: TimeOffRequest): number {
  return Math.round((parseDay(request.endDate) - parseDay(request.startDate)) / DAY_MS) + 1;
}

export function overlaps(a: TimeOffRequest, b: TimeOffRequest): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "19–21 Oct", collapsing the month when both ends share it. */
export function formatRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDay(startDate);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${start.getDate()}–${formatDay(endDate)}`
    : `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

/**
 * A role in running prose. Most positions lowercase cleanly; QA is an
 * acronym and keeps its case, so "2 other QAs in" rather than "qas".
 */
export function roleWord(position: Employee['position'], plural = false): string {
  const base = position === 'QA' ? 'QA' : position.toLowerCase();
  return plural ? `${base}s` : base;
}

export type ClashInfo = {
  /** Plain-language cover impact, safe to show on its own. */
  text: string;
  /** True when somebody in the same role is already signed off. */
  clash: boolean;
};

/**
 * What approving a request would cost in cover: the people in the same role
 * already signed off across the same days.
 *
 * This is the number that makes a request decidable without opening it, so
 * both the Home queue and the Time off queue read it from here.
 */
export function clashInfo(
  request: TimeOffRequest,
  requests: TimeOffRequest[],
  employees: Employee[],
): ClashInfo {
  const person = employees.find((e) => e.id === request.employeeId);
  if (!person) return { text: 'No clashes.', clash: false };

  const peers = employees.filter((e) => e.position === person.position);
  const peerIds = new Set(peers.map((e) => e.id));
  const clashing = requests.filter(
    (other) =>
      other.id !== request.id &&
      other.status === 'Approved' &&
      peerIds.has(other.employeeId) &&
      other.employeeId !== request.employeeId &&
      overlaps(other, request),
  );

  if (!clashing.length) {
    const others = peers.length - 1;
    return {
      text: others > 0
        ? `No clashes. ${others} other ${roleWord(person.position, others !== 1)} in.`
        : 'No clashes.',
      clash: false,
    };
  }

  return {
    text: `${clashing.length + 1} of ${peers.length} ${roleWord(person.position, true)} would be out.`,
    clash: true,
  };
}
