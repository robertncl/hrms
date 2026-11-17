import { Employee } from 'src/app/infrastructure/types/employee';
import { PayBand, SalaryChange, SharePrice, StockGrant } from 'src/app/infrastructure/types/compensation';
import { csvCell } from 'src/app/pages/employees/people-table';
import { grantValue, sharePriceOn } from 'src/app/shared/functions/equity';
import {
  BandStanding,
  bandFor,
  bandStanding,
  compaRatio,
  currentSalary,
  percentChange,
  previousSalary,
} from 'src/app/shared/functions/pay';

/** One person's pay and equity today, as the overview and profile show it. */
export type PaySummary = {
  employee: Employee;
  salary?: SalaryChange;
  band?: PayBand;
  compa?: number;
  standing?: BandStanding;
  /** The last change that took effect, with how much it moved pay. */
  lastChange?: { change: SalaryChange; percent: number | null };
  pending: SalaryChange[];
  grants: StockGrant[];
  sharesGranted: number;
  sharesVested: number;
  /** In USD, at today's share price. */
  vestedValue: number;
  unvestedValue: number;
};

export function paySummary(
  employee: Employee,
  changes: SalaryChange[],
  bands: PayBand[],
  grants: StockGrant[],
  prices: SharePrice[],
  today: string,
): PaySummary {
  const salary = currentSalary(changes, employee.id, today);
  // The band follows the currency they're actually paid in.
  const band = salary ? bandFor(bands, employee, salary.currency) : undefined;
  const before = salary ? previousSalary(changes, salary) : undefined;
  const own = grants.filter((g) => g.employeeId === employee.id);
  const price = sharePriceOn(prices, today)?.pricePerShare ?? 0;
  const values = own.map((g) => grantValue(g, price, today));
  return {
    employee,
    salary,
    band,
    compa: salary && band ? compaRatio(salary.baseSalary, band) : undefined,
    standing: salary && band ? bandStanding(salary.baseSalary, band) : undefined,
    lastChange: salary
      ? { change: salary, percent: before ? percentChange(before.baseSalary, salary.baseSalary) : null }
      : undefined,
    pending: changes.filter((c) => c.employeeId === employee.id && c.status === 'Pending'),
    grants: own,
    sharesGranted: own.reduce((sum, g) => sum + g.shares, 0),
    sharesVested: values.reduce((sum, v) => sum + v.vested, 0),
    vestedValue: values.reduce((sum, v) => sum + v.vestedValue, 0),
    unvestedValue: values.reduce((sum, v) => sum + v.unvestedValue, 0),
  };
}

export const STANDING_LABEL: Record<BandStanding, string> = {
  below: 'Below band',
  within: 'In band',
  above: 'Above band',
};

/** The overview table as CSV, for payroll and reviews. */
export function payCsv(rows: PaySummary[]): string {
  const header = ['Name', 'Job title', 'Department', 'Level', 'Location', 'Currency', 'Base salary', 'Band min', 'Band max',
    'Compa-ratio', 'Standing', 'Effective since', 'Shares granted', 'Shares vested', 'Vested value (USD)'];
  const lines = rows.map((row) => [
    `${row.employee.firstName} ${row.employee.lastName}`,
    row.employee.jobTitle ?? row.employee.position,
    row.employee.department ?? '',
    row.employee.level,
    row.employee.location ?? '',
    row.salary?.currency ?? '',
    row.salary ? String(row.salary.baseSalary) : '',
    row.band ? String(row.band.min) : '',
    row.band ? String(row.band.max) : '',
    row.compa !== undefined ? row.compa.toFixed(2) : '',
    row.standing ? STANDING_LABEL[row.standing] : '',
    row.salary?.effectiveDate ?? '',
    String(row.sharesGranted),
    String(row.sharesVested),
    String(Math.round(row.vestedValue)),
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\r\n');
}
