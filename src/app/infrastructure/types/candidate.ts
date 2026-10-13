export type CandidateStatus =
  | 'CV evaluation'
  | 'Interview preparation'
  | 'Interview Feedback'
  | 'Approved'
  | 'Rejected';

export type Candidate = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  level: string;
  status: string;
  offerAccepted: boolean;
  appliedAt?: string;
  interviewDate?: string;
  interviewerId?: number;
  rating?: number;
  feedback?: string;
  employeeId?: number;
};
