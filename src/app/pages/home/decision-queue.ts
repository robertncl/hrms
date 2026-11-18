import { Candidate } from 'src/app/infrastructure/types/candidate';
import { Course, Enrollment } from 'src/app/infrastructure/types/course';
import { Employee } from 'src/app/infrastructure/types/employee';
import { isOverdue } from 'src/app/pages/learning/learning';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import {
  DAY_MS,
  clashInfo,
  absenceType,
  formatRange,
  midnight,
  parseDay,
} from 'src/app/shared/functions/absence';
import { workingDays } from 'src/app/shared/functions/leave';
import { inScope, scopeOf } from 'src/app/shared/functions/org';
import { SalaryChange } from 'src/app/infrastructure/types/compensation';
import { formatChange, formatMoney, percentChange, previousSalary } from 'src/app/shared/functions/pay';

export type QueueKind = 'all' | 'timeoff' | 'hiring' | 'training' | 'pay';

/** Who the queue is for: it lists only what they can act on. */
export type QueueViewer = {
  canApprove: boolean;
  canHire: boolean;
  canAssign: boolean;
  /** Their own People record; without assign rights they see only their own training. */
  employeeId?: number;
  /**
   * False for people limited to their own reporting line (a team lead): they
   * see time off and training only for those who report to them. Defaults to
   * true.
   */
  orgWide?: boolean;
  /** HR: decides salary changes others have proposed. */
  canDecidePay?: boolean;
};

export const EVERYTHING: QueueViewer = { canApprove: true, canHire: true, canAssign: true };

/** One thing waiting on the signed-in user, from either side of the app. */
export type QueueItem = {
  id: string;
  kind: 'timeoff' | 'hiring' | 'training' | 'pay';
  name: string;
  what: string;
  note: string;
  tag?: string;
  /**
   * Which ACME status set the tag takes: a deadline or clash is a warning,
   * anything already overdue is danger.
   */
  tone?: 'warning' | 'danger';
  /** Urgent items float to the top and are counted in the page summary. */
  urgent: boolean;
  primary: string;
  secondary: string;
  link: (string | number)[];
  /** Set when the item can be approved straight from the queue. */
  request?: TimeOffRequest;
};

function timeOffItems(
  requests: TimeOffRequest[],
  employees: Employee[],
  today: Date,
): QueueItem[] {
  const names = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const todayMs = midnight(today).getTime();

  return requests
    .filter((request) => request.status === 'Pending')
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((request) => {
      const location = employees.find((e) => e.id === request.employeeId)?.location;
      const days = workingDays(request.startDate, request.endDate, location);
      const startsIn = Math.round((parseDay(request.startDate) - todayMs) / DAY_MS);
      const { text: clashText, clash } = clashInfo(request, requests, employees);

      // Soonest-starting requests are the ones that genuinely can't wait.
      const imminent = startsIn >= 0 && startsIn <= 3;
      const tag = imminent
        ? startsIn === 0
          ? 'Starts today'
          : startsIn === 1
            ? 'Starts tomorrow'
            : `Starts in ${startsIn} days`
        : clash
          ? 'Clash'
          : undefined;

      const comment = request.comment?.trim();
      return {
        id: `timeoff-${request.id}`,
        kind: 'timeoff' as const,
        name: names.get(request.employeeId) ?? `Employee #${request.employeeId}`,
        what: `${absenceType(request.type)} · ${formatRange(request.startDate, request.endDate)}`,
        note: `${days} ${days === 1 ? 'day' : 'days'} · ${clashText}${comment ? ` “${comment}”` : ''}`,
        tag,
        tone: tag ? ('warning' as const) : undefined,
        urgent: imminent,
        primary: 'Approve',
        secondary: 'Open',
        link: ['/work/time-off'],
        request,
      };
    });
}

function hiringItems(candidates: Candidate[], employees: Employee[], today: Date): QueueItem[] {
  const interviewers = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const todayMs = midnight(today).getTime();

  const items: QueueItem[] = [];

  for (const candidate of candidates) {
    const name = `${candidate.firstName} ${candidate.lastName}`;

    if (candidate.status === 'Interview Feedback') {
      const interviewer = candidate.interviewerId ? interviewers.get(candidate.interviewerId) : undefined;
      const daysSince = candidate.interviewDate
        ? Math.round((todayMs - parseDay(candidate.interviewDate)) / DAY_MS)
        : 0;
      // Scores more than two days old are what hold a pipeline up.
      const overdue = daysSince >= 2;
      items.push({
        id: `candidate-feedback-${candidate.id}`,
        kind: 'hiring',
        name,
        what: 'Interview feedback',
        note: interviewer
          ? `${interviewer} interviewed ${daysSince > 0 ? `${daysSince} ${daysSince === 1 ? 'day' : 'days'} ago` : 'today'} and hasn't scored yet.`
          : 'Waiting on interview scores.',
        tag: overdue ? 'Overdue' : undefined,
        tone: overdue ? ('danger' as const) : undefined,
        urgent: overdue,
        primary: 'Review',
        secondary: 'Open',
        link: ['/recruitment/candidates', candidate.id],
      });
      continue;
    }

    if (candidate.status === 'Approved' && !candidate.offerAccepted && !candidate.employeeId) {
      const rating = candidate.rating;
      items.push({
        id: `candidate-offer-${candidate.id}`,
        kind: 'hiring',
        name,
        what: 'Offer ready',
        note: `${candidate.level} ${String(candidate.position).toLowerCase()}${rating ? ` · rated ${rating} of 5` : ''}.`,
        urgent: false,
        primary: 'Send offer',
        secondary: 'Review',
        link: ['/recruitment/candidates', candidate.id],
      });
    }
  }

  return items;
}

/** Training past its due date: someone has to chase it. */
function trainingItems(
  enrollments: Enrollment[],
  courses: Course[],
  employees: Employee[],
): QueueItem[] {
  const names = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const titles = new Map(courses.map((c) => [c.id, c.title]));

  return enrollments
    .filter((enrollment) => isOverdue(enrollment))
    .map((enrollment) => ({
      id: `training-${enrollment.id}`,
      kind: 'training' as const,
      name: names.get(enrollment.employeeId) ?? `Employee #${enrollment.employeeId}`,
      what: 'Training overdue',
      note: `${titles.get(enrollment.courseId) ?? `Course #${enrollment.courseId}`}${
        enrollment.dueDate ? `, due ${formatRange(enrollment.dueDate, enrollment.dueDate)}` : ''
      }. ${enrollment.progress}% done.`,
      tag: 'Overdue',
      tone: 'danger' as const,
      urgent: true,
      primary: 'Open',
      secondary: 'View course',
      link: ['/learning/courses', enrollment.courseId],
    }));
}

function payItems(changes: SalaryChange[], employees: Employee[], today: Date): QueueItem[] {
  const names = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const todayMs = midnight(today).getTime();
  return changes
    .filter((change) => change.status === 'Pending')
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .map((change) => {
      const before = previousSalary(changes, change);
      const startsIn = Math.round((parseDay(change.effectiveDate) - todayMs) / DAY_MS);
      // A change due within a week has to be decided before payroll runs.
      const soon = startsIn <= 7;
      const to = formatMoney(change.baseSalary, change.currency);
      const move = before
        ? `${formatMoney(before.baseSalary, before.currency)} → ${to}` +
          (before.currency === change.currency ? ` (${formatChange(percentChange(before.baseSalary, change.baseSalary))})` : '')
        : to;
      return {
        id: `pay-${change.id}`,
        kind: 'pay' as const,
        name: names.get(change.employeeId) ?? `Employee #${change.employeeId}`,
        what: `${change.reason} · from ${formatRange(change.effectiveDate, change.effectiveDate)}`,
        note: `${move}${change.proposedBy ? `, proposed by ${change.proposedBy}` : ''}.`,
        tag: soon ? (startsIn <= 0 ? 'Overdue' : `Starts in ${startsIn} ${startsIn === 1 ? 'day' : 'days'}`) : undefined,
        tone: soon ? (startsIn <= 0 ? ('danger' as const) : ('warning' as const)) : undefined,
        urgent: soon,
        primary: 'Review',
        secondary: 'Profile',
        link: ['/compensation', change.employeeId],
      };
    });
}

/**
 * The Home queue: pending time off first (it has a deadline), then hiring
 * steps that are blocking someone else. Urgent items float to the top of
 * their group.
 *
 * Each viewer sees only what their role can act on, so the queue never offers
 * an approval the API would refuse.
 */
export function buildDecisionQueue(
  requests: TimeOffRequest[],
  candidates: Candidate[],
  employees: Employee[],
  enrollments: Enrollment[] = [],
  courses: Course[] = [],
  salaryChanges: SalaryChange[] = [],
  viewer: QueueViewer = EVERYTHING,
  today = new Date(),
): QueueItem[] {
  // Approvals and training chases stop at the edge of the viewer's reporting line.
  const scope = scopeOf(employees, { orgWide: viewer.orgWide ?? true, employeeId: viewer.employeeId });
  const own = (employeeId: number) => employeeId === viewer.employeeId;
  const training = enrollments.filter(
    (e) => own(e.employeeId) || (viewer.canAssign && inScope(scope, e.employeeId)),
  );
  const items = [
    ...(viewer.canApprove
      ? timeOffItems(requests, employees, today).filter((item) => inScope(scope, item.request!.employeeId))
      : []),
    ...(viewer.canHire ? hiringItems(candidates, employees, today) : []),
    ...trainingItems(training, courses, employees),
    // Raises others proposed, for the people in HR's scope. Nobody decides their own.
    ...(viewer.canDecidePay
      ? payItems(salaryChanges.filter((c) => inScope(scope, c.employeeId) && !own(c.employeeId)), employees, today)
      : []),
  ];
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

export function countByKind(
  items: QueueItem[],
): { all: number; timeoff: number; hiring: number; training: number; pay: number } {
  return {
    all: items.length,
    timeoff: items.filter((item) => item.kind === 'timeoff').length,
    hiring: items.filter((item) => item.kind === 'hiring').length,
    training: items.filter((item) => item.kind === 'training').length,
    pay: items.filter((item) => item.kind === 'pay').length,
  };
}
