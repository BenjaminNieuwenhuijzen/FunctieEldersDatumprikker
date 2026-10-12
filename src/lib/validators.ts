import type { DateOption, VotePayload } from './types';
import { NO_PREFERENCE } from './types';

export const LIMITS = { name: 40, reason: 280, suggestionName: 80, url: 300 } as const;

export type VoteErrors = Partial<Record<'name' | 'availability' | 'venue' | 'suggestion', string>>;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Client-side controle voor snelle feedback. De Edge Function valideert opnieuw (server is leidend). */
export function validateVote(
  payload: Partial<VotePayload>,
  dateOptions: DateOption[],
  venueIds: string[],
): VoteErrors {
  const errors: VoteErrors = {};
  const name = (payload.displayName ?? '').trim();
  if (!name) errors.name = 'Vul een naam of voornaam in.';
  else if (name.length > LIMITS.name) errors.name = `Maximaal ${LIMITS.name} tekens.`;

  const valid = new Set(dateOptions.map((d) => d.id));
  const answered = Object.keys(payload.availability ?? {}).filter((id) => valid.has(id));
  if (answered.length === 0) errors.availability = 'Geef bij minstens één datum een antwoord.';

  const choice = payload.venueChoice;
  if (!choice || (choice !== NO_PREFERENCE && !venueIds.includes(choice))) {
    errors.venue = 'Kies een restaurant of "geen voorkeur".';
  }

  const s = payload.suggestion;
  if (s && (s.name.trim() || s.reason.trim() || s.url?.trim())) {
    if (!s.name.trim()) errors.suggestion = 'Geef je restaurantidee een naam.';
    else if (s.name.length > LIMITS.suggestionName || s.reason.length > LIMITS.reason)
      errors.suggestion = 'Naam of motivatie is te lang.';
    else if (s.url?.trim() && (!isHttpUrl(s.url.trim()) || s.url.length > LIMITS.url))
      errors.suggestion = 'Gebruik een geldige link die met https:// begint.';
  }
  return errors;
}
