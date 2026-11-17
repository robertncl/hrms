import { StockGrant } from 'src/app/infrastructure/types/compensation';
import {
  describeVesting,
  exercisableShares,
  grantProblem,
  grantValue,
  isExpired,
  nextVesting,
  sharePriceOn,
  sharePriceProblem,
  valuePerShare,
  vestedShares,
  vestingSchedule,
} from './equity';

const options: StockGrant = {
  id: 1, employeeId: 1, kind: 'Stock options', grantDate: '2024-03-15', shares: 4_800, strikePrice: 2,
  vestingStart: '2024-03-15', vestingMonths: 48, cliffMonths: 12, expirationDate: '2034-03-15', exercisedShares: 0,
};
const rsus: StockGrant = {
  id: 2, employeeId: 1, kind: 'RSUs', grantDate: '2026-01-10', shares: 1_200,
  vestingStart: '2026-01-10', vestingMonths: 12, cliffMonths: 0, exercisedShares: 0,
};

describe('equity', () => {
  describe('vesting', () => {
    it('should vest nothing before the cliff', () => {
      expect(vestedShares(options, '2024-03-14')).toBe(0);
      expect(vestedShares(options, '2025-03-14')).toBe(0);
    });

    it('should vest the months served so far at the cliff, then monthly', () => {
      expect(vestedShares(options, '2025-03-15')).toBe(1_200);
      expect(vestedShares(options, '2025-04-14')).toBe(1_200);
      expect(vestedShares(options, '2025-04-15')).toBe(1_300);
    });

    it('should vest everything at the end, and no more after it', () => {
      expect(vestedShares(options, '2028-03-15')).toBe(4_800);
      expect(vestedShares(options, '2031-01-01')).toBe(4_800);
    });

    it('should round down part shares until the end', () => {
      const odd = { ...options, shares: 1_000 };
      expect(vestedShares(odd, '2025-03-15')).toBe(250);
      expect(vestedShares(odd, '2025-04-15')).toBe(270);
      expect(vestedShares(odd, '2028-03-15')).toBe(1_000);
    });

    it('should list every vesting date, from the cliff to the end', () => {
      const schedule = vestingSchedule(options);
      expect(schedule.length).toBe(37);
      expect(schedule[0]).toEqual({ date: '2025-03-15', vested: 1_200, shares: 1_200 });
      expect(schedule[1]).toEqual({ date: '2025-04-15', vested: 1_300, shares: 100 });
      expect(schedule.at(-1)).toEqual({ date: '2028-03-15', vested: 4_800, shares: 100 });
    });

    it('should vest monthly from the first month without a cliff', () => {
      expect(vestingSchedule(rsus)[0]).toEqual({ date: '2026-02-10', vested: 100, shares: 100 });
      expect(nextVesting(rsus, '2026-02-10')?.date).toBe('2026-03-10');
      expect(nextVesting(rsus, '2027-01-10')).toBeUndefined();
    });

    it('should describe the terms in words', () => {
      expect(describeVesting(options)).toBe('4 years, monthly after a 1-year cliff');
      expect(describeVesting(rsus)).toBe('1 year, monthly');
      expect(describeVesting({ vestingMonths: 30, cliffMonths: 6 })).toBe('30 months, monthly after a 6-month cliff');
    });
  });

  describe('exercising and value', () => {
    it('should let vested options be exercised until they expire', () => {
      const partly = { ...options, exercisedShares: 1_000 };
      expect(exercisableShares(partly, '2025-04-15')).toBe(300);
      expect(isExpired(partly, '2034-03-15')).toBeFalse();
      expect(exercisableShares(partly, '2034-03-16')).toBe(0);
    });

    it('should never exercise RSUs', () => {
      expect(exercisableShares(rsus, '2027-06-01')).toBe(0);
    });

    it('should value options at the gain over the strike, and RSUs at the price', () => {
      expect(valuePerShare(options, 9.5)).toBe(7.5);
      expect(valuePerShare(options, 1.5)).toBe(0);
      expect(valuePerShare(rsus, 9.5)).toBe(9.5);
    });

    it('should split a grant into vested and unvested value, leaving out exercised and lapsed options', () => {
      const partly = { ...options, exercisedShares: 1_000 };
      expect(grantValue(partly, 10, '2025-04-15')).toEqual({ vested: 300, unvested: 3_500, vestedValue: 2_400, unvestedValue: 28_000 });
      expect(grantValue(partly, 10, '2035-01-01')).toEqual({ vested: 0, unvested: 0, vestedValue: 0, unvestedValue: 0 });
    });

    it('should price a day at the latest valuation already in effect', () => {
      const prices = [
        { id: 1, effectiveDate: '2025-01-01', pricePerShare: 4 },
        { id: 2, effectiveDate: '2026-06-01', pricePerShare: 9 },
      ];
      expect(sharePriceOn(prices, '2026-05-31')?.pricePerShare).toBe(4);
      expect(sharePriceOn(prices, '2026-06-01')?.pricePerShare).toBe(9);
      expect(sharePriceOn(prices, '2024-12-31')).toBeUndefined();
    });
  });

  describe('checking a grant', () => {
    const asOf = '2026-11-17';

    it('should accept standard options and RSUs', () => {
      expect(grantProblem(options, asOf)).toBeNull();
      expect(grantProblem(rsus, asOf)).toBeNull();
    });

    it('should say what is wrong', () => {
      expect(grantProblem({ ...options, kind: 'Warrants' }, asOf)).toBe('Choose stock options or RSUs.');
      expect(grantProblem({ ...options, shares: 0 }, asOf)).toBe('Grant a whole number of shares, at least one.');
      expect(grantProblem({ ...options, shares: 10.5 }, asOf)).toBe('Grant a whole number of shares, at least one.');
      expect(grantProblem({ ...options, grantDate: 'today' }, asOf)).toBe('Pick the grant date and when vesting starts.');
      expect(grantProblem({ ...options, vestingMonths: 0 }, asOf)).toBe('Vesting takes between 1 and 120 months.');
      expect(grantProblem({ ...options, cliffMonths: 60 }, asOf)).toBe("The cliff can't be longer than vesting.");
      expect(grantProblem({ ...options, strikePrice: 0 }, asOf)).toBe('Options need a strike price above zero.');
      expect(grantProblem({ ...options, expirationDate: '2024-01-01' }, asOf)).toBe('Options need an expiry date after the grant date.');
      expect(grantProblem({ ...rsus, strikePrice: 1 }, asOf)).toBe("RSUs don't have a strike price or an expiry date.");
      expect(grantProblem({ ...rsus, exercisedShares: 10 }, asOf)).toBe("RSUs aren't exercised: they're delivered as they vest.");
    });

    it('should not let more options be exercised than have vested', () => {
      expect(grantProblem({ ...options, exercisedShares: 3_200 }, asOf)).toBeNull();
      expect(grantProblem({ ...options, exercisedShares: 3_201 }, asOf))
        .toBe('Only 3,200 of these options have vested, so no more can be exercised.');
    });
  });

  it('should check a share price', () => {
    expect(sharePriceProblem({ pricePerShare: 11.25, effectiveDate: '2026-11-17' })).toBeNull();
    expect(sharePriceProblem({ pricePerShare: 0, effectiveDate: '2026-11-17' })).toBe('Enter a price per share above zero.');
    expect(sharePriceProblem({ pricePerShare: 2, effectiveDate: '' })).toBe('Pick the day the valuation applies from.');
  });
});
