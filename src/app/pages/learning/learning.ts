import { Course, CourseCategory, CourseFormat, Enrollment } from 'src/app/infrastructure/types/course';
import { BadgeTone } from 'src/app/shared/functions/status-badge';
import { daysFromToday } from 'src/app/demo/demo-data';

export const COURSE_CATEGORIES: CourseCategory[] = ['Onboarding', 'Compliance', 'Technical', 'Leadership', 'Soft skills'];
export const COURSE_FORMATS: CourseFormat[] = ['Self-paced', 'Video', 'Workshop'];

export function isOverdue(enrollment: Pick<Enrollment, 'status' | 'dueDate'>, today = daysFromToday(0)): boolean {
  return enrollment.status !== 'Completed' && !!enrollment.dueDate && enrollment.dueDate < today;
}

export function enrollmentTone(enrollment: Pick<Enrollment, 'status' | 'dueDate'>): BadgeTone {
  if (isOverdue(enrollment)) return 'critical';
  switch (enrollment.status) {
    case 'Completed':
      return 'good';
    case 'In progress':
      return 'info';
    default:
      return 'warning';
  }
}

export function enrollmentLabel(enrollment: Pick<Enrollment, 'status' | 'dueDate'>): string {
  return isOverdue(enrollment) ? 'Overdue' : enrollment.status;
}

/** Share of enrollments completed, as a whole percentage (0 when there are none). */
export function completionRate(enrollments: Pick<Enrollment, 'status'>[]): number {
  if (!enrollments.length) return 0;
  return Math.round((enrollments.filter((e) => e.status === 'Completed').length / enrollments.length) * 100);
}

export function formatDuration(course: Pick<Course, 'durationHours'>): string {
  const hours = course.durationHours;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}
