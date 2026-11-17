import { addMonths, firstOfNextMonth, isIsoDate, monthsBetween, toIsoDate } from './dates';

describe('dates', () => {
  it('should recognise real yyyy-mm-dd dates only', () => {
    expect(isIsoDate('2027-02-28')).toBeTrue();
    expect(isIsoDate('2028-02-29')).toBeTrue();
    expect(isIsoDate('2027-02-29')).toBeFalse();
    expect(isIsoDate('2027-2-1')).toBeFalse();
    expect(isIsoDate('soon')).toBeFalse();
    expect(isIsoDate(20270201)).toBeFalse();
  });

  it('should pad years before 1000', () => {
    expect(toIsoDate(new Date(1, 0, 1, 12))).toMatch(/^\d{4}-01-01$/);
  });

  it('should add months, landing on the month end when the day is missing', () => {
    expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-05-10', 48)).toBe('2030-05-10');
  });

  it('should count whole months only once the anniversary day comes round', () => {
    expect(monthsBetween('2026-01-15', '2026-02-14')).toBe(0);
    expect(monthsBetween('2026-01-15', '2026-02-15')).toBe(1);
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(1);
    expect(monthsBetween('2025-01-15', '2026-01-15')).toBe(12);
    expect(monthsBetween('2026-03-01', '2026-01-01')).toBe(0);
  });

  it('should give the first of the next month', () => {
    expect(firstOfNextMonth('2026-11-17')).toBe('2026-12-01');
    expect(firstOfNextMonth('2026-12-31')).toBe('2027-01-01');
  });
});
