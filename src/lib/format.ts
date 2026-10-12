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

/** Eerste letter hoofdletter (Nederlandse maanden/dagen blijven verder klein). */
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function describeDate(o: DateOption): string {
  const p = formatDateParts(o.localDate);
  return `${capFirst(p.long)}${o.startTime ? ` · ${o.startTime}` : ''}`;
}

/**
 * Lokale datum + tijd in Europe/Amsterdam → ISO-tijdstip (UTC). Houdt rekening met zomer-/wintertijd.
 */
export function amsterdamToIso(localDate: string, time: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const wanted = Date.UTC(y, m - 1, d, hh, mm);
  // Bepaal de offset van Amsterdam rond dat moment en corrigeer (twee iteraties is genoeg rond DST).
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: TIMEZONE,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .formatToParts(new Date(guess))
        .map((p) => [p.type, p.value]),
    );
    const shown = Date.UTC(
      +parts.year!,
      +parts.month! - 1,
      +parts.day!,
      +parts.hour!,
      +parts.minute!,
    );
    guess += wanted - shown;
  }
  return new Date(guess).toISOString();
}
