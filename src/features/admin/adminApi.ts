import { supabase } from '../../lib/supabase';
import { ApiError, messageFor, rpc } from '../../lib/supabaseApi';
import type { Answer, EventStatus } from '../../lib/types';

/**
 * Beheeracties. Autorisatie gebeurt in de database (RLS-policies met is_admin()), niet hier:
 * een niet-beheerder krijgt bij elke aanroep een fout of lege resultaten.
 */

export interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  starts_at: string | null;
  decided_venue_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AdminDateOption {
  id: string;
  event_id: string;
  local_date: string;
  start_time: string | null;
  label: string | null;
}

export interface AdminVenue {
  id: string;
  slug: string;
  name: string;
  city: string;
  cuisine_tags: string[];
  website_url: string | null;
  description: string | null;
  price_band: number | null;
  verified_at: string | null;
}

export interface AdminParticipant {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  availability: Record<string, Answer>;
  venueChoice: string | null;
}

export interface AdminSuggestion {
  id: string;
  suggested_name: string;
  submitted_by_label: string | null;
  reason: string | null;
  url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'duplicate';
  created_at: string;
}

export interface AdminExclusion {
  id: string;
  label: string;
  reason: string | null;
}

function db() {
  if (!supabase) throw new ApiError('Backend is niet geconfigureerd.');
  return supabase;
}

async function run<T>(
  p: PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>,
  fallback = 'Opslaan is mislukt.',
): Promise<T> {
  const { data, error } = await p;
  if (error) {
    if (error.code === '23505') throw new ApiError('Bestaat al (dubbele waarde).');
    if (error.code === '23514') throw new ApiError('Ongeldige waarde. Controleer de invoer.');
    if (error.code === '42501') throw new ApiError('Hiervoor heb je geen beheerrechten.');
    throw new ApiError(messageFor(error, fallback));
  }
  return data as T;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const adminApi = {
  amIAdmin: () => rpc<boolean>(db(), 'am_i_admin'),

  listEvents: () =>
    run<AdminEvent[]>(db().from('events').select('*').order('created_at', { ascending: false })),
  createEvent: (title: string, slug: string) =>
    run<AdminEvent>(db().from('events').insert({ title, slug }).select().single()),
  updateEvent: (id: string, patch: Partial<AdminEvent>) =>
    run(
      db()
        .from('events')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id),
    ),

  listDateOptions: (eventId: string) =>
    run<AdminDateOption[]>(
      db()
        .from('event_date_options')
        .select('*')
        .eq('event_id', eventId)
        .order('local_date')
        .order('start_time'),
    ),
  addDateOption: (eventId: string, localDate: string, startTime: string | null, label: string) =>
    run(
      db()
        .from('event_date_options')
        .insert({
          event_id: eventId,
          local_date: localDate,
          start_time: startTime,
          label: label || null,
        }),
    ),
  deleteDateOption: (id: string) => run(db().from('event_date_options').delete().eq('id', id)),

  listVenues: () => run<AdminVenue[]>(db().from('venues').select('*').order('name')),
  createVenue: (v: Partial<AdminVenue>) => run(db().from('venues').insert(v)),
  updateVenue: (id: string, patch: Partial<AdminVenue>) =>
    run(db().from('venues').update(patch).eq('id', id)),

  listEventVenueIds: async (eventId: string) =>
    (
      await run<{ venue_id: string }[]>(
        db().from('event_venue_options').select('venue_id').eq('event_id', eventId),
      )
    ).map((r) => r.venue_id),
  setEventVenue: (eventId: string, venueId: string, on: boolean) =>
    on
      ? run(db().from('event_venue_options').insert({ event_id: eventId, venue_id: venueId }))
      : run(
          db().from('event_venue_options').delete().eq('event_id', eventId).eq('venue_id', venueId),
        ),

  listExclusions: (eventId: string) =>
    run<AdminExclusion[]>(
      db().from('event_exclusions').select('id,label,reason').eq('event_id', eventId),
    ),

  listParticipants: (eventId: string) =>
    rpc<AdminParticipant[]>(db(), 'admin_list_participants', { p_event_id: eventId }),
  deleteParticipant: (id: string) => run(db().from('participants').delete().eq('id', id)),

  listSuggestions: () =>
    run<AdminSuggestion[]>(
      db().from('venue_suggestions').select('*').order('created_at', { ascending: false }),
    ),
  setSuggestionStatus: (id: string, status: AdminSuggestion['status']) =>
    run(
      db()
        .from('venue_suggestions')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id),
    ),

  /** Afronden: werkelijke datum + restaurant handmatig bevestigen en als bezoek vastleggen. */
  async completeEvent(
    event: AdminEvent,
    o: { visitedOn: string; startsAt: string | null; venueId: string; notes: string },
  ) {
    await run(
      db()
        .from('visits')
        .insert({
          event_id: event.id,
          venue_id: o.venueId,
          visited_on: o.visitedOn,
          notes: o.notes || null,
        }),
    );
    await adminApi.updateEvent(event.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      decided_venue_id: o.venueId,
      starts_at: o.startsAt,
    });
  },

  getSubmissionsEnabled: async () => {
    const rows = await run<{ value: unknown }[]>(
      db().from('app_settings').select('value').eq('key', 'submissions_enabled'),
    );
    return rows[0]?.value !== false;
  },
  setSubmissionsEnabled: (on: boolean) =>
    run(
      db()
        .from('app_settings')
        .update({ value: on, updated_at: new Date().toISOString() })
        .eq('key', 'submissions_enabled'),
    ),
  purge: (days: number) => rpc<number>(db(), 'purge_vote_details', { p_older_than_days: days }),
};
