import { GRANT_KINDS, GrantKind, SharePrice, StockGrant } from 'src/app/infrastructure/types/compensation';
import { addMonths, isIsoDate, monthsBetween } from './dates';

/** Standard terms: four years, monthly after a one-year cliff, options lapse after ten years. */
export const DEFAULT_VESTING_MONTHS = 48;
export const DEFAULT_CLIFF_MONTHS = 12;
export const OPTION_TERM_YEARS = 10;
const MAX_SHARES = 10_000_000;

/** Shares vested by `asOf`: nothing before the cliff, then a share of the grant for every month served. */
export function vestedShares(grant: Pick<StockGrant, 'shares' | 'vestingStart' | 'vestingMonths' | 'cliffMonths'>, asOf: string): number {
  const months = monthsBetween(grant.vestingStart, asOf);
  if (months < grant.cliffMonths) return 0;
  if (months >= grant.vestingMonths) return grant.shares;
  return Math.floor((grant.shares * months) / grant.vestingMonths);
}

export type VestingEvent = { date: string; /** Vested in total once this date passes. */ vested: number; /** Newly vested on this date. */ shares: number };

/** Every date shares vest, from the cliff to the end. */
export function vestingSchedule(grant: Pick<StockGrant, 'shares' | 'vestingStart' | 'vestingMonths' | 'cliffMonths'>): VestingEvent[] {
  const events: VestingEvent[] = [];
  let before = 0;
  for (let month = Math.max(grant.cliffMonths, 1); month <= grant.vestingMonths; month++) {
    const date = addMonths(grant.vestingStart, month);
    const vested = vestedShares(grant, date);
    if (vested > before) {
      events.push({ date, vested, shares: vested - before });
      before = vested;
    }
  }
  return events;
}

/** The next date any shares vest after `asOf`, if there is one. */
export function nextVesting(grant: Pick<StockGrant, 'shares' | 'vestingStart' | 'vestingMonths' | 'cliffMonths'>, asOf: string): VestingEvent | undefined {
  return vestingSchedule(grant).find((event) => event.date > asOf);
}

export function isExpired(grant: Pick<StockGrant, 'expirationDate'>, asOf: string): boolean {
  return !!grant.expirationDate && grant.expirationDate < asOf;
}

/** Vested options that can still be bought on `asOf`. RSUs are never exercised. */
export function exercisableShares(grant: StockGrant, asOf: string): number {
  if (grant.kind !== 'Stock options' || isExpired(grant, asOf)) return 0;
  return Math.max(0, vestedShares(grant, asOf) - grant.exercisedShares);
}

/** The share price on `asOf`: the latest valuation already in effect. */
export function sharePriceOn(prices: SharePrice[], asOf: string): SharePrice | undefined {
  return [...prices]
    .filter((price) => price.effectiveDate <= asOf)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id - b.id)
    .at(-1);
}

/** What one share of a grant is worth at `price`: the gain over the strike for options, the price for RSUs. */
export function valuePerShare(grant: Pick<StockGrant, 'kind' | 'strikePrice'>, price: number): number {
  return grant.kind === 'RSUs' ? price : Math.max(0, price - (grant.strikePrice ?? 0));
}

export type GrantValue = {
  vested: number;
  unvested: number;
  /** Vested and unvested together, in USD. */
  vestedValue: number;
  unvestedValue: number;
};

/**
 * A grant on `asOf` at `price`. Options already exercised are owned shares,
 * not options, so they drop out; lapsed options are worth nothing.
 */
export function grantValue(grant: StockGrant, price: number, asOf: string): GrantValue {
  const vestedTotal = vestedShares(grant, asOf);
  const expired = grant.kind === 'Stock options' && isExpired(grant, asOf);
  const vested = expired ? 0 : Math.max(0, vestedTotal - grant.exercisedShares);
  const unvested = expired ? 0 : grant.shares - vestedTotal;
  const each = valuePerShare(grant, price);
  return { vested, unvested, vestedValue: vested * each, unvestedValue: unvested * each };
}

/** "4 years, monthly after a 1-year cliff". */
export function describeVesting(grant: Pick<StockGrant, 'vestingMonths' | 'cliffMonths'>): string {
  const span = (months: number) =>
    months % 12 === 0 ? `${months / 12} ${months === 12 ? 'year' : 'years'}` : `${months} ${months === 1 ? 'month' : 'months'}`;
  // A length used as an adjective takes a hyphen and the singular: "a 1-year cliff", "a 6-month cliff".
  const cliffSpan = grant.cliffMonths % 12 === 0 ? `${grant.cliffMonths / 12}-year` : `${grant.cliffMonths}-month`;
  const cliff = grant.cliffMonths ? ` after a ${cliffSpan} cliff` : '';
  return `${span(grant.vestingMonths)}, monthly${cliff}`;
}

/** Why a grant can't be saved, or null when it can. `asOf` bounds what can be exercised. */
export function grantProblem(grant: Partial<Record<keyof StockGrant, unknown>>, asOf: string): string | null {
  const kind = grant.kind as GrantKind;
  if (!GRANT_KINDS.includes(kind)) return 'Choose stock options or RSUs.';
  const whole = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  if (!whole(grant.shares, 1, MAX_SHARES)) return 'Grant a whole number of shares, at least one.';
  if (!isIsoDate(grant.grantDate) || !isIsoDate(grant.vestingStart)) return 'Pick the grant date and when vesting starts.';
  if (!whole(grant.vestingMonths, 1, 120)) return 'Vesting takes between 1 and 120 months.';
  if (!whole(grant.cliffMonths, 0, grant.vestingMonths as number)) return "The cliff can't be longer than vesting.";
  if (kind === 'Stock options') {
    const strike = grant.strikePrice;
    if (typeof strike !== 'number' || !Number.isFinite(strike) || strike <= 0) return 'Options need a strike price above zero.';
    if (!isIsoDate(grant.expirationDate) || grant.expirationDate <= (grant.grantDate as string)) {
      return 'Options need an expiry date after the grant date.';
    }
  } else if (grant.strikePrice !== undefined || grant.expirationDate !== undefined) {
    return "RSUs don't have a strike price or an expiry date.";
  }
  const exercised = grant.exercisedShares ?? 0;
  if (!whole(exercised, 0, grant.shares as number)) return 'Exercised shares have to be a whole number, no more than the grant.';
  if (kind === 'RSUs' && exercised !== 0) return "RSUs aren't exercised: they're delivered as they vest.";
  const vested = vestedShares(grant as StockGrant, asOf);
  if ((exercised as number) > vested) {
    return `Only ${vested.toLocaleString('en-GB')} of these options have vested, so no more can be exercised.`;
  }
  if (grant.note !== undefined && (typeof grant.note !== 'string' || grant.note.length > 500)) {
    return 'Keep the note under 500 characters.';
  }
  return null;
}

/** Why a share price can't be saved, or null when it can. */
export function sharePriceProblem(price: Partial<Record<keyof SharePrice, unknown>>): string | null {
  const value = price.pricePerShare;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100_000) return 'Enter a price per share above zero.';
  if (!isIsoDate(price.effectiveDate)) return 'Pick the day the valuation applies from.';
  if (price.note !== undefined && (typeof price.note !== 'string' || price.note.length > 500)) {
    return 'Keep the note under 500 characters.';
  }
  return null;
}
