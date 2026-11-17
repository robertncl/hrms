import { PayBand, SalaryChange } from 'src/app/infrastructure/types/compensation';
import {
  bandFor,
  bandPosition,
  bandProblem,
  bandStanding,
  compaRatio,
  currencyFor,
  currentSalary,
  formatChange,
  formatCompact,
  formatMoney,
  median,
  percentChange,
  previousSalary,
  salaryChangeProblem,
} from './pay';

const change = (id: number, effectiveDate: string, baseSalary: number, status: SalaryChange['status'] = 'Approved', employeeId = 1): SalaryChange => ({
  id, employeeId, effectiveDate, baseSalary, status, currency: 'GBP', reason: 'Merit increase',
});
const band: PayBand = { id: 1, position: 'Developer', level: 'Senior', currency: 'GBP', min: 70_000, max: 90_000 };

describe('pay', () => {
  it('should pay Lisbon and Berlin in euros, and everyone else in pounds', () => {
    expect(currencyFor('Lisbon')).toBe('EUR');
    expect(currencyFor('Berlin')).toBe('EUR');
    expect(currencyFor('London')).toBe('GBP');
    expect(currencyFor('Remote')).toBe('GBP');
    expect(currencyFor(undefined)).toBe('GBP');
  });

  it('should format money with plain symbols', () => {
    expect(formatMoney(72_000, 'GBP')).toBe('£72,000');
    expect(formatMoney(58_500, 'EUR')).toBe('€58,500');
    expect(formatMoney(9.4, 'USD', 2)).toBe('$9.40');
    expect(formatCompact(1_234_000, 'GBP')).toMatch(/^£1\.2[Mm]$/);
    expect(formatChange(7.14)).toBe('+7.1%');
    expect(formatChange(-2)).toBe('−2.0%');
    expect(formatChange(0)).toBe('0.0%');
  });

  describe('history', () => {
    const changes = [
      change(1, '2024-01-01', 60_000),
      change(2, '2025-04-01', 63_000),
      change(3, '2026-04-01', 66_000),
      change(4, '2026-12-01', 70_000, 'Pending'),
      change(5, '2026-06-01', 99_000, 'Rejected'),
      change(6, '2026-05-01', 40_000, 'Approved', 2),
    ];

    it("should take the latest approved change already in effect as today's salary", () => {
      expect(currentSalary(changes, 1, '2026-11-17')?.baseSalary).toBe(66_000);
      expect(currentSalary(changes, 1, '2026-03-31')?.baseSalary).toBe(63_000);
      expect(currentSalary(changes, 1, '2023-12-31')).toBeUndefined();
    });

    it('should find the salary a change replaced', () => {
      expect(previousSalary(changes, changes[2])?.baseSalary).toBe(63_000);
      expect(previousSalary(changes, changes[3])?.baseSalary).toBe(66_000);
      expect(previousSalary(changes, changes[0])).toBeUndefined();
    });

    it('should work out a percentage change', () => {
      expect(percentChange(63_000, 66_000)).toBeCloseTo(4.76, 2);
      expect(percentChange(0, 10)).toBe(0);
    });
  });

  describe('bands', () => {
    it("should find the band for a person's role, level and currency", () => {
      const eur = { ...band, id: 2, currency: 'EUR' as const };
      expect(bandFor([band, eur], { position: 'Developer', level: 'Senior' }, 'EUR')).toBe(eur);
      expect(bandFor([band], { position: 'QA', level: 'Senior' }, 'GBP')).toBeUndefined();
    });

    it('should compare a salary with the band midpoint', () => {
      expect(compaRatio(80_000, band)).toBe(1);
      expect(compaRatio(72_000, band)).toBe(0.9);
    });

    it('should say whether a salary is below, within or above its band', () => {
      expect(bandStanding(69_999, band)).toBe('below');
      expect(bandStanding(70_000, band)).toBe('within');
      expect(bandStanding(90_000, band)).toBe('within');
      expect(bandStanding(90_001, band)).toBe('above');
    });

    it('should place a salary across its band, clamped to the ends', () => {
      expect(bandPosition(80_000, band)).toBe(50);
      expect(bandPosition(60_000, band)).toBe(0);
      expect(bandPosition(100_000, band)).toBe(100);
    });

    it('should refuse a band whose top is not above its bottom', () => {
      expect(bandProblem({ min: 50_000, max: 60_000 })).toBeNull();
      expect(bandProblem({ min: 60_000, max: 60_000 })).toBe('The top of the band has to be above the bottom.');
      expect(bandProblem({ min: -1, max: 60_000 })).toBe('Enter whole amounts above zero.');
      expect(bandProblem({ min: 1.5, max: 60_000 })).toBe('Enter whole amounts above zero.');
    });
  });

  it('should take the median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  describe('checking a salary change', () => {
    const good = { baseSalary: 70_000, currency: 'GBP', effectiveDate: '2026-12-01', reason: 'Promotion' };

    it('should accept a complete change', () => {
      expect(salaryChangeProblem(good)).toBeNull();
      expect(salaryChangeProblem({ ...good, note: 'Ready for Senior.' })).toBeNull();
    });

    it('should say what is wrong', () => {
      expect(salaryChangeProblem({ ...good, baseSalary: 0 })).toBe('Enter a salary above zero.');
      expect(salaryChangeProblem({ ...good, baseSalary: '70000' })).toBe('Enter a salary above zero.');
      expect(salaryChangeProblem({ ...good, baseSalary: 70_000.5 })).toBe('Enter the salary in whole units.');
      expect(salaryChangeProblem({ ...good, baseSalary: 50_000_000 })).toContain('Check for an extra zero.');
      expect(salaryChangeProblem({ ...good, currency: 'USD' })).toBe('Pay is in pounds (GBP) or euros (EUR).');
      expect(salaryChangeProblem({ ...good, effectiveDate: '2026-02-30' })).toBe('Pick the day the new salary starts.');
      expect(salaryChangeProblem({ ...good, reason: 'Because' })).toBe('Choose a reason for the change.');
      expect(salaryChangeProblem({ ...good, note: 'x'.repeat(501) })).toBe('Keep the note under 500 characters.');
    });
  });
});
