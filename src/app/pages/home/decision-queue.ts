import { Candidate } from 'src/app/infrastructure/types/candidate';
import { Employee } from 'src/app/infrastructure/types/employee';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import {
  DAY_MS,
  clashInfo,
  dayCount,
  formatRange,
  midnight,
  parseDay,
} from 'src/app/shared/functions/absence';

export type QueueKind = 'all' | 'timeoff' | 'hiring';

/** One thing waiting on the signed-in user, from either side of the app. */
export type QueueItem = {
  id: string;
  kind: 'timeoff' | 'hiring';
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

/**
 * The Home queue: pending time off first (it has a deadline), then hiring
 * steps that are blocking someone else. Urgent items float to the top of
 * their group.
 */
export function buildDecisionQueue(
  requests: TimeOffRequest[],
  candidates: Candidate[],
  employees: Employee[],
  today = new Date(),
): QueueItem[] {
  const items = [
    ...timeOffItems(requests, employees, today),
    ...hiringItems(candidates, employees, today),
  ];
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

export function countByKind(items: QueueItem[]): { all: number; timeoff: number; hiring: number } {
  return {
    all: items.length,
    timeoff: items.filter((item) => item.kind === 'timeoff').length,
    hiring: items.filter((item) => item.kind === 'hiring').length,
  };
}
