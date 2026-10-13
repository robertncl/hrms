import { Candidate } from 'src/app/infrastructure/types/candidate';
import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';

export type BadgeTone = 'good' | 'warning' | 'serious' | 'critical' | 'info';

export function timeOffTone(status: TimeOffRequest['status']): BadgeTone {
  switch (status) {
    case 'Approved':
      return 'good';
    case 'Rejected':
      return 'critical';
    default:
      return 'warning';
  }
}

/** Label shown for a candidate's place in the pipeline. */
export function candidateStage(candidate: Pick<Candidate, 'status' | 'offerAccepted' | 'employeeId'>): string {
  if (candidate.status === 'Approved') {
    if (candidate.employeeId) return 'Hired';
    return candidate.offerAccepted ? 'Onboarding' : 'Offer sent';
  }
  return candidate.status;
}

export function candidateTone(candidate: Pick<Candidate, 'status' | 'offerAccepted' | 'employeeId'>): BadgeTone {
  switch (candidate.status) {
    case 'Approved':
      return 'good';
    case 'Rejected':
      return 'critical';
    case 'Interview Feedback':
      return 'warning';
    default:
      return 'info';
  }
}
