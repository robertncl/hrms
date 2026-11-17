import { Employee } from './employee';

/** Pay currencies: London and remote people are paid in pounds, Lisbon and Berlin in euros. */
export const PAY_CURRENCIES = ['GBP', 'EUR'] as const;
export type PayCurrency = (typeof PAY_CURRENCIES)[number];

/** Shares are priced in US dollars, whatever currency someone is paid in. */
export const EQUITY_CURRENCY = 'USD';

export const PAY_CHANGE_REASONS = ['New hire', 'Promotion', 'Merit increase', 'Market adjustment', 'Correction'] as const;
export type PayChangeReason = (typeof PAY_CHANGE_REASONS)[number];

export const PAY_CHANGE_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export type PayChangeStatus = (typeof PAY_CHANGE_STATUSES)[number];

/**
 * One step in somebody's base salary history. HR records changes directly;
 * a lead's change starts as a proposal (`Pending`) until HR decides it.
 */
export type SalaryChange = {
  id: number;
  employeeId: number;
  /** The day the new salary starts. */
  effectiveDate: string;
  /** Yearly base salary, in whole units of `currency`. */
  baseSalary: number;
  currency: PayCurrency;
  reason: PayChangeReason;
  status: PayChangeStatus;
  note?: string;
  /** Who proposed or recorded it. */
  proposedBy?: string;
  proposedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
};

/** The salary range for a role and level, in one currency. Its midpoint is the market rate. */
export type PayBand = {
  id: number;
  position: Employee['position'];
  level: Employee['level'];
  currency: PayCurrency;
  min: number;
  max: number;
};

export const GRANT_KINDS = ['Stock options', 'RSUs'] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

/**
 * Equity granted to one person. Options are the right to buy shares at the
 * strike price once vested; RSUs are shares delivered as they vest.
 */
export type StockGrant = {
  id: number;
  employeeId: number;
  kind: GrantKind;
  grantDate: string;
  shares: number;
  /** Price per share to exercise an option, in USD. RSUs have none. */
  strikePrice?: number;
  vestingStart: string;
  /** Months until fully vested; shares vest monthly after the cliff. */
  vestingMonths: number;
  /** Nothing vests before this many months; then the months so far vest at once. */
  cliffMonths: number;
  /** Options lapse on this day. */
  expirationDate?: string;
  /** Options already bought. Always 0 for RSUs. */
  exercisedShares: number;
  note?: string;
};

/** A valuation of one share, in USD. The latest one on or before a day is the price that day. */
export type SharePrice = {
  id: number;
  effectiveDate: string;
  pricePerShare: number;
  note?: string;
};
