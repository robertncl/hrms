import { Candidate } from 'src/app/infrastructure/types/candidate';
import { Course, Enrollment } from 'src/app/infrastructure/types/course';
import { Employee } from 'src/app/infrastructure/types/employee';
import { isOverdue } from 'src/app/pages/learning/learning';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import {
  DAY_MS,
  clashInfo,
  dayCount,
  formatRange,
  midnight,
  parseDay,
} from 'src/app/shared/functions/absence';

export type QueueKind = 'all' | 'timeoff' | 'hiring' | 'training';

/** Who the queue is for: it lists only what they can act on. */
export type QueueViewer = {
  canApprove: boolean;
  canHire: boolean;
  canAssign: boolean;
  /** Their own People record; without assign rights they see only their own training. */
  employeeId?: number;
};

export const EVERYTHING: QueueViewer = { canApprove: true, canHire: true, canAssign: true };

/** One thing waiting on the signed-in user, from either side of the app. */
export type QueueItem = {
  id: string;
  kind: 'timeoff' | 'hiring' | 'training';
  name: string;
  what: string;
  note: string;
  tag?: string;
  /** Urgent items take the danger tag and are counted in the page summary. */
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
      const days = dayCount(request);
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
        what: `${request.type} · ${formatRange(request.startDate, request.endDate)}`,
        note: `${days} ${days === 1 ? 'day' : 'days'} · ${clashText}${comment ? ` “${comment}”` : ''}`,
        tag,
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
      urgent: true,
      primary: 'Open',
      secondary: 'View course',
      link: ['/learning/courses', enrollment.courseId],
    }));
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
  viewer: QueueViewer = EVERYTHING,
  today = new Date(),
): QueueItem[] {
  const ownTraining = enrollments.filter((e) => e.employeeId === viewer.employeeId);
  const items = [
    ...(viewer.canApprove ? timeOffItems(requests, employees, today) : []),
    ...(viewer.canHire ? hiringItems(candidates, employees, today) : []),
    ...trainingItems(viewer.canAssign ? enrollments : ownTraining, courses, employees),
  ];
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

export function countByKind(
  items: QueueItem[],
): { all: number; timeoff: number; hiring: number; training: number } {
  return {
    all: items.length,
    timeoff: items.filter((item) => item.kind === 'timeoff').length,
    hiring: items.filter((item) => item.kind === 'hiring').length,
    training: items.filter((item) => item.kind === 'training').length,
  };
}
