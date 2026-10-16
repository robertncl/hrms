/** "12 Mar 2023". */
export function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** How long someone has been at ACME: "3 days", "6 weeks", "5 months", "3 years, 2 months". */
export function tenure(startDate: string, today = new Date()): string {
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((now.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return `Starts ${formatLongDate(startDate)}`;
  if (days < 14) return days === 0 ? 'Starts today' : plural(days, 'day');

  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) -
    (now.getDate() < start.getDate() ? 1 : 0);
  if (months < 2) return plural(Math.floor(days / 7), 'week');
  if (months < 12) return plural(months, 'month');

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${plural(years, 'year')}, ${plural(rest, 'month')}` : plural(years, 'year');
}
