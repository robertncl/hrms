import { Candidate } from 'src/app/infrastructure/types/candidate';
import { Employee } from 'src/app/infrastructure/types/employee';
import { DAY_MS, midnight, parseDay } from 'src/app/shared/functions/absence';
import { candidateStage } from 'src/app/shared/functions/status-badge';

/** Board columns, in pipeline order, and the stage each one holds. */
export const BOARD_COLUMNS = [
  { title: 'New', stage: 'CV evaluation' },
  { title: 'Interview', stage: 'Interview preparation' },
  { title: 'Feedback', stage: 'Interview Feedback' },
  { title: 'Offer', stage: 'Offer sent' },
  { title: 'Onboarding', stage: 'Onboarding' },
] as const;

export type BoardCard = {
  candidate: Candidate;
  name: string;
  role: string;
  note: string;
  /** True when the note reports something overdue. */
  late: boolean;
  /** Compact time in pipeline, e.g. "4d". */
  age: string;
};

export type BoardColumn = {
  title: string;
  stage: string;
  cards: BoardCard[];
};

function age(candidate: Candidate, today: Date): string {
  if (!candidate.appliedAt) return '';
  const days = Math.max(0, Math.round((midnight(today).getTime() - parseDay(candidate.appliedAt)) / DAY_MS));
  return `${days}d`;
}

/**
 * The one line that says what this card is waiting for. Each stage has a
 * different blocker, and "overdue" is only ever about elapsed time.
 */
function note(
  candidate: Candidate,
  stage: string,
  interviewers: Map<number, string>,
  today: Date,
): { note: string; late: boolean } {
  switch (stage) {
    case 'CV evaluation':
      return { note: 'CV to review', late: false };

    case 'Interview preparation':
      return candidate.interviewDate
        ? { note: `Interview ${new Date(`${candidate.interviewDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, late: false }
        : { note: 'Pick a date', late: false };

    case 'Interview Feedback': {
      const days = candidate.interviewDate
        ? Math.round((midnight(today).getTime() - parseDay(candidate.interviewDate)) / DAY_MS)
        : 0;
      if (days >= 2) {
        return { note: `Scores ${days} days late`, late: true };
      }
      const who = candidate.interviewerId ? interviewers.get(candidate.interviewerId) : undefined;
      return { note: who ? `Waiting on ${who.split(' ')[0]}` : 'Waiting on scores', late: false };
    }

    case 'Offer sent':
      return {
        note: candidate.rating ? `Rated ${candidate.rating} · send offer` : 'Send offer',
        late: false,
      };

    case 'Onboarding':
      return { note: 'Accepted · onboarding', late: false };

    default:
      return { note: '', late: false };
  }
}

/** Candidates grouped into board columns, oldest first within each column. */
export function buildBoard(
  candidates: Candidate[],
  employees: Employee[],
  today = new Date(),
): BoardColumn[] {
  const interviewers = new Map(employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  return BOARD_COLUMNS.map((column) => ({
    title: column.title,
    stage: column.stage,
    cards: candidates
      .filter((candidate) => candidateStage(candidate) === column.stage)
      .sort((a, b) => (a.appliedAt ?? '').localeCompare(b.appliedAt ?? ''))
      .map((candidate) => {
        const { note: text, late } = note(candidate, column.stage, interviewers, today);
        return {
          candidate,
          name: `${candidate.firstName} ${candidate.lastName}`,
          role: `${candidate.position} · ${String(candidate.level).toLowerCase()}`,
          note: text,
          late,
          age: age(candidate, today),
        };
      }),
  }));
}
