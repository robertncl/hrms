import { Employee } from 'src/app/infrastructure/types/employee';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';

export type LeaveType = TimeOffRequest['type'];

/**
 * Working days a year per leave type. Types not listed (maternity and
 * paternity leave) are statutory and have no balance to run down.
 */
export const LEAVE_ENTITLEMENTS: Partial<Record<LeaveType, number>> = {
  Vacation: 25,
  'Sick Leave': 10,
  Other: 3,
};

export const TRACKED_LEAVE_TYPES = Object.keys(LEAVE_ENTITLEMENTS) as LeaveType[];

type Calendar = 'London' | 'Lisbon' | 'Berlin';

/**
 * Public holidays by office. Years outside this table have none listed, so
 * only weekends are skipped there: extend it each year.
 */
const PUBLIC_HOLIDAYS: Record<Calendar, string[]> = {
  London: [
    '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
    '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
  ],
  Lisbon: [
    '2026-01-01', '2026-04-03', '2026-04-05', '2026-04-25', '2026-05-01', '2026-06-04', '2026-06-10', '2026-06-13',
    '2026-08-15', '2026-10-05', '2026-11-01', '2026-12-01', '2026-12-08', '2026-12-25',
    '2027-01-01', '2027-03-26', '2027-03-28', '2027-04-25', '2027-05-01', '2027-05-27', '2027-06-10', '2027-06-13',
    '2027-08-15', '2027-10-05', '2027-11-01', '2027-12-01', '2027-12-08', '2027-12-25',
  ],
  Berlin: [
    '2026-01-01', '2026-03-08', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-14', '2026-05-25', '2026-10-03',
    '2026-12-25', '2026-12-26',
    '2027-01-01', '2027-03-08', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17', '2027-10-03',
    '2027-12-25', '2027-12-26',
  ],
};

const HOLIDAY_SETS = Object.fromEntries(
  Object.entries(PUBLIC_HOLIDAYS).map(([office, days]) => [office, new Set(days)]),
) as Record<Calendar, Set<string>>;

/** Remote people, and anyone without a location, follow the London calendar. */
function calendarFor(location: string | undefined): Set<string> {
  return HOLIDAY_SETS[(location as Calendar) in HOLIDAY_SETS ? (location as Calendar) : 'London'];
}

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parse = (date: string) => new Date(`${date}T00:00:00`);

export function isWorkingDay(date: string, location?: string): boolean {
  const weekday = parse(date).getDay();
  return weekday !== 0 && weekday !== 6 && !calendarFor(location).has(date);
}

/** `date` itself when it is a working day, otherwise the first working day after it. */
export function nextWorkingDay(date: string, location?: string): string {
  const day = parse(date);
  while (!isWorkingDay(iso(day), location)) day.setDate(day.getDate() + 1);
  return iso(day);
}

/**
 * Days of leave a date range costs: weekdays that aren't public holidays where
 * the person works. With `year`, only the days falling in that year count.
 */
export function workingDays(startDate: string, endDate: string, location?: string, year?: number): number {
  let count = 0;
  const end = parse(endDate);
  for (const day = parse(startDate); day <= end; day.setDate(day.getDate() + 1)) {
    if ((year === undefined || day.getFullYear() === year) && isWorkingDay(iso(day), location)) count++;
  }
  return count;
}

/** A year's allowance, reduced in proportion for someone who joins part-way through it. */
export function entitlement(employee: Pick<Employee, 'startDate'>, type: LeaveType, year: number): number {
  const full = LEAVE_ENTITLEMENTS[type] ?? 0;
  if (!employee.startDate) return full;
  const start = parse(employee.startDate);
  if (start.getFullYear() < year) return full;
  if (start.getFullYear() > year) return 0;
  const yearEnd = new Date(year, 11, 31);
  const daysInYear = Math.round((yearEnd.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000) + 1;
  const daysEmployed = Math.round((yearEnd.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.round((full * daysEmployed) / daysInYear);
}

export type LeaveBalance = {
  employeeId: number;
  year: number;
  type: LeaveType;
  entitlement: number;
  /** Approved days. */
  taken: number;
  /** Days in requests still waiting for a decision. */
  pending: number;
  /** What is left to book: entitlement less taken and pending. */
  remaining: number;
};

type Person = Pick<Employee, 'id' | 'startDate' | 'location'>;

/** One balance per tracked leave type for `year`. Declined requests cost nothing. */
export function leaveBalances(employee: Person, requests: TimeOffRequest[], year: number): LeaveBalance[] {
  const own = requests.filter((request) => request.employeeId === employee.id && request.status !== 'Rejected');
  return TRACKED_LEAVE_TYPES.map((type) => {
    const days = (status: TimeOffRequest['status']) =>
      own
        .filter((request) => request.type === type && request.status === status)
        .reduce((sum, request) => sum + workingDays(request.startDate, request.endDate, employee.location, year), 0);
    const allowance = entitlement(employee, type, year);
    const taken = days('Approved');
    const pending = days('Pending');
    return { employeeId: employee.id, year, type, entitlement: allowance, taken, pending, remaining: allowance - taken - pending };
  });
}

const plural = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;
const label = (type: LeaveType) => (type === 'Other' ? 'personal leave' : type.toLowerCase());

/**
 * Why a request can't be booked, or null when it can. `request.id` (when
 * present) is left out of the tally, so an existing request isn't counted twice.
 */
export function leaveProblem(
  employee: Person,
  requests: TimeOffRequest[],
  request: Pick<TimeOffRequest, 'type' | 'startDate' | 'endDate'> & { id?: number },
): string | null {
  if (request.endDate < request.startDate) return "The last day can't be before the first day.";
  if (workingDays(request.startDate, request.endDate, employee.location) === 0) {
    return 'Those dates are all weekends or public holidays, so no leave is needed.';
  }
  if (!(request.type in LEAVE_ENTITLEMENTS)) return null;

  const others = requests.filter((other) => other.id !== request.id);
  for (let year = parse(request.startDate).getFullYear(); year <= parse(request.endDate).getFullYear(); year++) {
    const needed = workingDays(request.startDate, request.endDate, employee.location, year);
    const balance = leaveBalances(employee, others, year).find((b) => b.type === request.type)!;
    if (needed > balance.remaining) {
      return `This needs ${plural(needed)} of ${label(request.type)} in ${year}, and only ${Math.max(balance.remaining, 0)} of ${balance.entitlement} are left.`;
    }
  }
  return null;
}
