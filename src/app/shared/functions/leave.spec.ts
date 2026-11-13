import { TimeOffRequest } from 'src/app/infrastructure/types/time-off-request.type';
import { dateRangeProblem, entitlement, isWorkingDay, leaveBalances, leaveProblem, workingDays } from './leave';

describe('leave', () => {
  const request = (id: number, type: TimeOffRequest['type'], startDate: string, endDate: string, status: TimeOffRequest['status'] = 'Approved', employeeId = 1): TimeOffRequest =>
    ({ id, employeeId, type, startDate, endDate, status });
  const londoner = { id: 1, startDate: '2020-03-01', location: 'London' };

  describe('working days', () => {
    it('should skip weekends', () => {
      // Mon 9 Nov – Sun 15 Nov 2026
      expect(workingDays('2026-11-09', '2026-11-15', 'London')).toBe(5);
      expect(workingDays('2026-11-14', '2026-11-15', 'London')).toBe(0);
      expect(workingDays('2026-11-12', '2026-11-12', 'London')).toBe(1);
    });

    it("should skip the public holidays of the person's office", () => {
      // Tue 1 Dec 2026 is a holiday in Portugal only; Tue 8 Dec too.
      expect(workingDays('2026-11-30', '2026-12-04', 'Lisbon')).toBe(4);
      expect(workingDays('2026-11-30', '2026-12-04', 'London')).toBe(5);
      expect(isWorkingDay('2026-12-28', 'London')).toBeFalse(); // Boxing Day, observed
      expect(isWorkingDay('2026-12-28', 'Berlin')).toBeTrue();
    });

    it('should use the London calendar for remote people', () => {
      expect(isWorkingDay('2026-12-28', 'Remote')).toBeFalse();
      expect(isWorkingDay('2026-12-28', undefined)).toBeFalse();
    });

    it('should count only the days in the asked-for year', () => {
      // Mon 28 Dec 2026 – Fri 8 Jan 2027, Berlin: 28–31 Dec, then 4–8 Jan (1 Jan is a holiday).
      expect(workingDays('2026-12-28', '2027-01-08', 'Berlin', 2026)).toBe(4);
      expect(workingDays('2026-12-28', '2027-01-08', 'Berlin', 2027)).toBe(5);
      expect(workingDays('2026-12-28', '2027-01-08', 'Berlin')).toBe(9);
    });
  });

  describe('entitlement', () => {
    it('should give the full allowance to people who joined in an earlier year', () => {
      expect(entitlement({ startDate: '2020-03-01' }, 'Vacation', 2026)).toBe(25);
      expect(entitlement({}, 'Sick Leave', 2026)).toBe(10);
    });

    it('should pro-rate the year someone joins', () => {
      expect(entitlement({ startDate: '2026-07-02' }, 'Vacation', 2026)).toBe(13); // 183 of 365 days
      expect(entitlement({ startDate: '2026-12-31' }, 'Vacation', 2026)).toBe(0);
      expect(entitlement({ startDate: '2026-01-01' }, 'Vacation', 2026)).toBe(25);
    });

    it('should give nothing before the start year and nothing for untracked types', () => {
      expect(entitlement({ startDate: '2027-02-01' }, 'Vacation', 2026)).toBe(0);
      expect(entitlement({ startDate: '2020-03-01' }, 'Maternity Leave', 2026)).toBe(0);
    });
  });

  describe('balances', () => {
    const requests = [
      request(1, 'Vacation', '2026-11-09', '2026-11-13'), // 5 taken
      request(2, 'Vacation', '2026-11-23', '2026-11-24', 'Pending'), // 2 pending
      request(3, 'Vacation', '2026-12-01', '2026-12-05', 'Rejected'), // costs nothing
      request(4, 'Sick Leave', '2026-10-05', '2026-10-05'),
      request(5, 'Vacation', '2026-11-16', '2026-11-20', 'Approved', 2), // someone else
      request(6, 'Paternity Leave', '2026-06-01', '2026-08-31'), // untracked
    ];

    it('should split each tracked type into taken, pending and remaining', () => {
      expect(leaveBalances(londoner, requests, 2026)).toEqual([
        { employeeId: 1, year: 2026, type: 'Vacation', entitlement: 25, taken: 5, pending: 2, remaining: 18 },
        { employeeId: 1, year: 2026, type: 'Sick Leave', entitlement: 10, taken: 1, pending: 0, remaining: 9 },
        { employeeId: 1, year: 2026, type: 'Other', entitlement: 3, taken: 0, pending: 0, remaining: 3 },
      ]);
    });

    it('should keep each year separate', () => {
      const vacation = leaveBalances(londoner, requests, 2027).find((b) => b.type === 'Vacation')!;
      expect(vacation.remaining).toBe(25);
    });
  });

  describe('booking checks', () => {
    const taken = [request(1, 'Other', '2026-11-09', '2026-11-10')]; // 2 of 3 personal days

    it('should allow a request the balance covers', () => {
      expect(leaveProblem(londoner, taken, { type: 'Other', startDate: '2026-11-12', endDate: '2026-11-12' })).toBeNull();
    });

    it('should refuse a request that needs more than is left, saying how much is', () => {
      expect(leaveProblem(londoner, taken, { type: 'Other', startDate: '2026-11-12', endDate: '2026-11-13' }))
        .toBe('This needs 2 days of personal leave in 2026, and only 1 of 3 are left.');
    });

    it('should not count the request against itself when it is re-checked', () => {
      const pending = [...taken, request(2, 'Other', '2026-11-12', '2026-11-12', 'Pending')];
      expect(leaveProblem(londoner, pending, { id: 2, type: 'Other', startDate: '2026-11-12', endDate: '2026-11-12' })).toBeNull();
    });

    it('should check each year a request touches against that year', () => {
      // 23 Dec 2026 – 8 Jan 2027: 5 days in 2026 (23, 24, 29, 30, 31) and 5 in 2027.
      const almostOut = [request(1, 'Vacation', '2026-02-02', '2026-03-03')]; // 22 days taken
      expect(leaveProblem(londoner, almostOut, { type: 'Vacation', startDate: '2026-12-23', endDate: '2027-01-08' }))
        .toBe('This needs 5 days of vacation in 2026, and only 3 of 25 are left.');
      expect(leaveProblem(londoner, almostOut, { type: 'Vacation', startDate: '2026-12-29', endDate: '2027-01-08' })).toBeNull();
    });

    it('should never limit statutory leave', () => {
      expect(leaveProblem(londoner, [], { type: 'Maternity Leave', startDate: '2026-11-02', endDate: '2027-05-01' })).toBeNull();
    });

    it('should refuse dates with no working days, or that run backwards', () => {
      expect(leaveProblem(londoner, [], { type: 'Vacation', startDate: '2026-11-14', endDate: '2026-11-15' })).toContain('weekends or public holidays');
      expect(leaveProblem(londoner, [], { type: 'Vacation', startDate: '2026-11-13', endDate: '2026-11-12' })).toContain("can't be before");
    });
  });

  describe('date ranges', () => {
    it('should accept a real range of up to a year', () => {
      expect(dateRangeProblem('2027-01-01', '2027-12-31')).toBeNull();
      expect(dateRangeProblem('2028-01-01', '2028-12-31')).toBeNull(); // a leap year: 366 days
      expect(dateRangeProblem('2027-03-01', '2027-03-01')).toBeNull();
    });

    it('should refuse anything longer, backwards or not a real date', () => {
      expect(dateRangeProblem('2027-01-01', '2028-01-02')).toBe('Book at most a year at a time.');
      expect(dateRangeProblem('2027-03-02', '2027-03-01')).toBe("The last day can't be before the first day.");
      expect(dateRangeProblem('2027-02-29', '2027-03-01')).toBe('Pick a first and a last day.');
      expect(dateRangeProblem('', '2027-03-01')).toBe('Pick a first and a last day.');
      expect(dateRangeProblem(20270301, '2027-03-01')).toBe('Pick a first and a last day.');
    });

    it('should check the range before counting days', () => {
      const person = { id: 1, location: 'London' as const };
      expect(leaveProblem(person, [], { type: 'Maternity Leave', startDate: '0001-01-01', endDate: '9999-12-31' }))
        .toBe('Book at most a year at a time.');
    });
  });
});
