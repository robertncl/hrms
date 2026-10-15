export type CourseCategory = 'Onboarding' | 'Compliance' | 'Technical' | 'Leadership' | 'Soft skills';
export type CourseFormat = 'Self-paced' | 'Video' | 'Workshop';

export type Course = {
  id: number;
  title: string;
  category: CourseCategory;
  format: CourseFormat;
  durationHours: number;
  description: string;
  /** Mandatory courses are assigned to every new employee automatically. */
  mandatory: boolean;
  modules: string[];
};

export type EnrollmentStatus = 'Not started' | 'In progress' | 'Completed';

export type Enrollment = {
  id: number;
  courseId: number;
  employeeId: number;
  assignedAt: string;
  dueDate?: string;
  completedModules: number;
  completedAt?: string;
  /** Derived by the API from completedModules. */
  status: EnrollmentStatus;
  /** Derived by the API: 0–100. */
  progress: number;
};
