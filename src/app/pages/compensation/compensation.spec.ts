import { Employee } from 'src/app/infrastructure/types/employee';
import { createCompensationMocks, payBands, payPeople, payPrices } from 'src/testing/compensation.mock';
import { toIsoDate } from 'src/app/shared/functions/dates';
import { payCsv, paySummary } from './compensation';

describe('compensation summary', () => {
  const today = toIsoDate(new Date());
  const { changes, grants } = createCompensationMocks();
  const summary = (employee: Employee) => paySummary(employee, changes, bands(), grants, payPrices, today);
  const bands = () => payBands;

  it("should pull together someone's salary, band, last raise, proposals and equity", () => {
    const liam = summary(payPeople[1]);
    expect(liam.salary?.baseSalary).toBe(75_000);
    expect(liam.band?.id).toBe(2);
    expect(liam.compa).toBeCloseTo(0.9375, 4);
    expect(liam.standing).toBe('within');
    expect(liam.lastChange?.percent).toBeCloseTo(7.14, 2);
    expect(liam.pending.map((c) => c.id)).toEqual([4]);
    expect(liam).toEqual(jasmine.objectContaining({ sharesGranted: 4_800, sharesVested: 2_000, vestedValue: 16_000, unvestedValue: 19_200 }));
  });

  it('should match the band to the currency someone is paid in', () => {
    const noah = summary(payPeople[2]);
    expect(noah.band?.currency).toBe('EUR');
    expect(noah.standing).toBe('below');
    expect(noah.lastChange?.percent).toBeNull();
  });

  it('should leave the band out for someone with no salary yet', () => {
    const newcomer = summary({ ...payPeople[1], id: 42 });
    expect(newcomer.salary).toBeUndefined();
    expect(newcomer.band).toBeUndefined();
    expect(newcomer.sharesGranted).toBe(0);
  });

  it('should export the table as CSV, safe for spreadsheets', () => {
    const rows = [summary(payPeople[1]), summary({ ...payPeople[2], firstName: '=cmd' })];
    const [header, liam, noah] = payCsv(rows).split('\r\n');
    expect(header).toBe('Name,Job title,Department,Level,Location,Currency,Base salary,Band min,Band max,Compa-ratio,Standing,Effective since,Shares granted,Shares vested,Vested value (USD)');
    expect(liam).toContain('Liam Test,Senior Software Engineer,Engineering,Senior,London,GBP,75000,70000,90000,0.94,In band,');
    expect(liam.endsWith(',4800,2000,16000')).toBeTrue();
    expect(noah.startsWith("'=cmd Test,")).toBeTrue();
  });
});
