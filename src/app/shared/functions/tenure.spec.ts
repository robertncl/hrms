import { formatLongDate, tenure } from './tenure';

describe('tenure', () => {
  const today = new Date(2026, 9, 16); // 16 Oct 2026

  it('should count days, then weeks, then months, then years', () => {
    expect(tenure('2026-10-16', today)).toBe('Starts today');
    expect(tenure('2026-10-15', today)).toBe('1 day');
    expect(tenure('2026-10-06', today)).toBe('10 days');
    expect(tenure('2026-09-04', today)).toBe('6 weeks');
    expect(tenure('2026-05-16', today)).toBe('5 months');
    expect(tenure('2025-10-16', today)).toBe('1 year');
    expect(tenure('2023-08-01', today)).toBe('3 years, 2 months');
  });

  it('should not count a month that is not over yet', () => {
    expect(tenure('2026-04-17', today)).toBe('5 months');
  });

  it('should describe a future start date', () => {
    expect(tenure('2026-11-02', today)).toBe(`Starts ${formatLongDate('2026-11-02')}`);
  });
});
