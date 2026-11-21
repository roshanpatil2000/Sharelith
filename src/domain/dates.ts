/** An expense date: a calendar day, "YYYY-MM-DD", in the person's own time. */
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar day of `date` in local time. */
export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

export const todayISO = (now = new Date()): ISODate => toISODate(now);

/** Midnight local time on that day, for date pickers. */
export function fromISODate(day: ISODate): Date {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "21 November 2026". */
export const longDate = (day: ISODate) =>
  fromISODate(day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** "Today", "Yesterday", or "21 Nov 2026". */
export function friendlyDate(day: ISODate, now = new Date()): string {
  const today = todayISO(now);
  const yesterday = toISODate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  if (day === today) {
    return 'Today';
  }
  if (day === yesterday) {
    return 'Yesterday';
  }
  return fromISODate(day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
