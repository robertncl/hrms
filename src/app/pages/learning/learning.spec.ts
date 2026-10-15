import { completionRate, enrollmentLabel, enrollmentTone, formatDuration, isOverdue } from './learning';

describe('learning helpers', () => {
  it('should treat unfinished training past its due date as overdue', () => {
    expect(isOverdue({ status: 'In progress', dueDate: '2026-01-01' }, '2026-01-02')).toBeTrue();
    expect(isOverdue({ status: 'In progress', dueDate: '2026-01-02' }, '2026-01-02')).toBeFalse();
    expect(isOverdue({ status: 'Completed', dueDate: '2026-01-01' }, '2026-01-02')).toBeFalse();
    expect(isOverdue({ status: 'Not started' }, '2026-01-02')).toBeFalse();
  });

  it('should label and colour overdue training ahead of its status', () => {
    const overdue = { status: 'Not started' as const, dueDate: '2000-01-01' };
    expect(enrollmentLabel(overdue)).toBe('Overdue');
    expect(enrollmentTone(overdue)).toBe('critical');
    expect(enrollmentTone({ status: 'Completed' })).toBe('good');
    expect(enrollmentLabel({ status: 'In progress' })).toBe('In progress');
  });

  it('should compute the completion rate', () => {
    expect(completionRate([])).toBe(0);
    expect(completionRate([{ status: 'Completed' }, { status: 'In progress' }, { status: 'Completed' }])).toBe(67);
  });

  it('should format course durations', () => {
    expect(formatDuration({ durationHours: 0.5 })).toBe('30 min');
    expect(formatDuration({ durationHours: 1 })).toBe('1 hour');
    expect(formatDuration({ durationHours: 1.5 })).toBe('1.5 hours');
  });
});
