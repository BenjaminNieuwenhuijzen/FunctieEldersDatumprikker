import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyApi, type MyVote, type PollApi } from './api';
import { supabase } from './supabase';
import {
  NO_PREFERENCE,
  type PollEvent,
  type PublicTally,
  type Venue,
  type Visit,
  type VotePayload,
} from './types';

/** Fout met een Nederlandse, toonbare melding. */
export class ApiError extends Error {}

/** Database-excepties (raise exception '<code>') → begrijpelijke tekst. */
const MESSAGES: Record<string, string> = {
  poll_closed: 'Deze poll is gesloten. Stemmen of aanpassen kan niet meer.',
  not_found: 'Dit etentje bestaat niet (meer).',
  invalid_option: 'Een gekozen datum hoort niet (meer) bij deze poll. Ververs de pagina.',
  invalid_venue: 'Het gekozen restaurant hoort niet bij deze poll. Ververs de pagina.',
  invalid_availability: 'Geef bij minstens één datum een geldig antwoord.',
  invalid_name: 'Vul een naam in van maximaal 40 tekens.',
  invalid_suggestion: 'Je restaurantidee is niet geldig. Controleer naam en link.',
  rate_limited: 'Te veel pogingen. Probeer het over een uur opnieuw.',
  submissions_disabled: 'Stemmen staat tijdelijk uit. Probeer het later opnieuw.',
  not_authenticated: 'Je bent uitgelogd. Bevestig opnieuw je e-mailadres.',
  email_not_verified: 'Bevestig eerst je e-mailadres.',
  forbidden: 'Hiervoor heb je geen rechten.',
  dates_locked: 'De datumprikker zit nog op slot: eerst wordt het restaurant gekozen.',
  venue_phase_closed: 'Het restaurant is al gekozen. Ververs de pagina om je datums door te geven.',
};

export function messageFor(error: { message?: string } | null | undefined, fallback: string) {
  return (error?.message && MESSAGES[error.message]) || fallback;
}

export async function rpc<T>(
  client: SupabaseClient,
  fn: string,
  args?: Record<string, unknown>,
  fallback = 'Gegevens laden is mislukt. Probeer het later opnieuw.',
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new ApiError(messageFor(error, fallback));
  return data as T;
}

function createSupabaseApi(client: SupabaseClient): PollApi {
  return {
    getActiveEvent: () => rpc<PollEvent | null>(client, 'get_active_event'),
    getEventBySlug: (slug) => rpc<PollEvent | null>(client, 'get_public_event', { p_slug: slug }),
    async getTally(eventId) {
      const t = await rpc<PublicTally | null>(client, 'get_public_tally', { p_event_id: eventId });
      return t ?? { participantCount: 0, dates: {}, venues: { none: 0 } };
    },
    listVenues: () => rpc<Venue[]>(client, 'get_upcoming_venues'),
    async castVenueVote(eventId, p: VotePayload) {
      await rpc(
        client,
        'cast_venue_vote',
        {
          p_event_id: eventId,
          p_display_name: p.displayName,
          p_venue_id: p.venueChoice === NO_PREFERENCE ? null : p.venueChoice,
          p_no_preference: p.venueChoice === NO_PREFERENCE,
          p_suggestion: p.suggestion?.name ? p.suggestion : null,
        },
        'Opslaan is mislukt. Probeer het opnieuw.',
      );
    },
    async castAvailability(eventId, p: VotePayload) {
      await rpc(
        client,
        'cast_availability',
        { p_event_id: eventId, p_display_name: p.displayName, p_availability: p.availability },
        'Opslaan is mislukt. Probeer het opnieuw.',
      );
    },
    listVisits: () => rpc<Visit[]>(client, 'get_public_visits'),
    async getMyVote(eventId): Promise<MyVote> {
      const r = await rpc<{ vote: VotePayload | null; lastDisplayName: string | null } | null>(
        client,
        'get_my_vote',
        { p_event_id: eventId },
      );
      return { vote: r?.vote ?? null, lastDisplayName: r?.lastDisplayName ?? null };
    },
  };
}

export const api: PollApi = supabase ? createSupabaseApi(supabase) : emptyApi;
