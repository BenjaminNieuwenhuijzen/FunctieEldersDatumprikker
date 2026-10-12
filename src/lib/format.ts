import type { DateOption } from './types';

export const TIMEZONE = 'Europe/Amsterdam';

/** localDate is een kalenderdatum zonder tijdzone; formatteer als UTC-middag om DST-verschuiving te vermijden. */
function toDate(localDate: string): Date {
  return new Date(`${localDate}T12:00:00Z`);
}

export function formatDateParts(localDate: string) {
  const d = toDate(localDate);
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('nl-NL', { ...o, timeZone: 'UTC' }).format(d);
  return {
    weekday: f({ weekday: 'long' }),
    day: f({ day: 'numeric' }),
    month: f({ month: 'long' }),
    short: f({ weekday: 'short', day: 'numeric', month: 'short' }),
    long: f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

export function describeDate(o: DateOption): string {
  const p = formatDateParts(o.localDate);
  return `${p.long}${o.startTime ? ` · ${o.startTime}` : ''}`;
}
