/** Local-time date helpers for yyyy-mm-dd strings. */

export const parseIso = (date: string) => new Date(`${date}T00:00:00`);

export function toIsoDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A real calendar date written yyyy-mm-dd. */
export function isIsoDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && toIsoDate(parseIso(date)) === date;
}

/**
 * `months` calendar months after `date`, landing on the last day of the month
 * when that day doesn't exist (31 Jan + 1 month = 28 or 29 Feb).
 */
export function addMonths(date: string, months: number): string {
  const start = parseIso(date);
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(start.getDate(), lastDay));
  return toIsoDate(target);
}

/** Whole calendar months from `from` to `to` (0 when `to` is earlier). */
export function monthsBetween(from: string, to: string): number {
  if (to < from) return 0;
  const a = parseIso(from);
  const b = parseIso(to);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  // Not a full month yet until the anniversary day (or month end) comes round.
  if (addMonths(from, months) > to) months--;
  return Math.max(0, months);
}

/** The first day of the month after `date`: when pay changes usually take effect. */
export function firstOfNextMonth(date: string): string {
  const d = parseIso(date);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}
