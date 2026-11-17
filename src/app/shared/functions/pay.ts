import { Employee } from 'src/app/infrastructure/types/employee';
import {
  PAY_CHANGE_REASONS,
  PAY_CURRENCIES,
  PayBand,
  PayCurrency,
  SalaryChange,
} from 'src/app/infrastructure/types/compensation';
import { isIsoDate } from './dates';

/** The most anyone's base salary can be: a guard against a slipped zero. */
export const MAX_BASE_SALARY = 5_000_000;

/** Lisbon and Berlin are paid in euros; London, remote and anyone else in pounds. */
export function currencyFor(location: Employee['location'] | undefined): PayCurrency {
  return location === 'Lisbon' || location === 'Berlin' ? 'EUR' : 'GBP';
}

const formatters = new Map<string, Intl.NumberFormat>();

/** "£72,000", "€58,500"; `digits` for share prices ("$9.40"). */
export function formatMoney(amount: number, currency: string, digits = 0): string {
  const key = `${currency}:${digits}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      // "$9.40", not "US$9.40".
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(key, format);
  }
  return format.format(amount);
}

/** "£1.2m", "€640k": totals where the exact figure is noise. */
export function formatCompact(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

/** "+4.5%", "−2.0%", "0.0%". */
export function formatChange(percent: number): string {
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
}

/** Approved changes for one person, oldest first. */
export function salaryHistory(changes: SalaryChange[], employeeId: number): SalaryChange[] {
  return changes
    .filter((change) => change.employeeId === employeeId && change.status === 'Approved')
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id - b.id);
}

/** What someone is paid on `asOf`: the latest approved change already in effect. */
export function currentSalary(changes: SalaryChange[], employeeId: number, asOf: string): SalaryChange | undefined {
  return salaryHistory(changes, employeeId)
    .filter((change) => change.effectiveDate <= asOf)
    .at(-1);
}

/** The approved salary before `change` took effect, if any. */
export function previousSalary(changes: SalaryChange[], change: Pick<SalaryChange, 'employeeId' | 'effectiveDate' | 'id'>): SalaryChange | undefined {
  return salaryHistory(changes, change.employeeId)
    .filter((other) => other.id !== change.id && other.effectiveDate <= change.effectiveDate)
    .at(-1);
}

/** Percentage change from `before` to `after`. */
export function percentChange(before: number, after: number): number {
  return before ? ((after - before) / before) * 100 : 0;
}

export function bandFor(
  bands: PayBand[],
  employee: Pick<Employee, 'position' | 'level'>,
  currency: PayCurrency,
): PayBand | undefined {
  return bands.find((b) => b.position === employee.position && b.level === employee.level && b.currency === currency);
}

export const bandMidpoint = (band: Pick<PayBand, 'min' | 'max'>) => (band.min + band.max) / 2;

/** Salary over the band midpoint: 1.00 is the market rate. */
export function compaRatio(salary: number, band: Pick<PayBand, 'min' | 'max'>): number {
  return salary / bandMidpoint(band);
}

export type BandStanding = 'below' | 'within' | 'above';

export function bandStanding(salary: number, band: Pick<PayBand, 'min' | 'max'>): BandStanding {
  return salary < band.min ? 'below' : salary > band.max ? 'above' : 'within';
}

/** Where a salary sits across its band, 0–100, clamped to the ends. */
export function bandPosition(salary: number, band: Pick<PayBand, 'min' | 'max'>): number {
  if (band.max <= band.min) return 50;
  return Math.min(100, Math.max(0, ((salary - band.min) / (band.max - band.min)) * 100));
}

/** The median of a list of numbers, or null for none. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Why a salary change can't be saved, or null when it can. */
export function salaryChangeProblem(change: Partial<Record<keyof SalaryChange, unknown>>): string | null {
  const amount = change.baseSalary;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return 'Enter a salary above zero.';
  if (!Number.isInteger(amount)) return 'Enter the salary in whole units.';
  if (amount > MAX_BASE_SALARY) return `Salaries above ${formatMoney(MAX_BASE_SALARY, 'GBP').slice(1)} aren't accepted. Check for an extra zero.`;
  if (!PAY_CURRENCIES.includes(change.currency as PayCurrency)) return 'Pay is in pounds (GBP) or euros (EUR).';
  if (!isIsoDate(change.effectiveDate)) return 'Pick the day the new salary starts.';
  if (!PAY_CHANGE_REASONS.includes(change.reason as SalaryChange['reason'])) return 'Choose a reason for the change.';
  if (change.note !== undefined && (typeof change.note !== 'string' || change.note.length > 500)) {
    return 'Keep the note under 500 characters.';
  }
  return null;
}

/** Why a pay band can't be saved, or null when it can. */
export function bandProblem(band: Partial<Pick<PayBand, 'min' | 'max'>>): string | null {
  const { min, max } = band;
  if (![min, max].every((v) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_BASE_SALARY)) {
    return 'Enter whole amounts above zero.';
  }
  if (max! <= min!) return 'The top of the band has to be above the bottom.';
  return null;
}
