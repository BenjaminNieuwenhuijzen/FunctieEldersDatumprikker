import type { PollEvent, PublicTally, Venue, Visit, VotePayload } from './types';

export interface MyVote {
  /** Bestaande stem voor dit event, of null. */
  vote: VotePayload | null;
  /** Naam die deze gebruiker eerder gebruikte (voor vooraf invullen). */
  lastDisplayName: string | null;
}

/**
 * Enige toegangspoort van de UI tot data. `supabaseApi` als de backend is geconfigureerd,
 * anders `emptyApi` (eerlijke lege staten, geen verzonnen data).
 */
export interface PollApi {
  /** Het open (of net gesloten) event, of null als er geen publieke poll is. */
  getActiveEvent(): Promise<PollEvent | null>;
  getEventBySlug(slug: string): Promise<PollEvent | null>;
  getTally(eventId: string): Promise<PublicTally>;
  /** Kandidaat-restaurants voor het eerstvolgende etentje. */
  listVenues(): Promise<Venue[]>;
  /** Vereist een ingelogde gebruiker met bevestigd e-mailadres. Nieuw of wijziging. */
  castVote(eventId: string, payload: VotePayload): Promise<void>;
  getMyVote(eventId: string): Promise<MyVote>;
  /** Bevestigde bezoeken, nieuwste eerst. */
  listVisits(): Promise<Visit[]>;
}

export class NotConfiguredError extends Error {
  constructor() {
    super('Opslag is nog niet geconfigureerd.');
    this.name = 'NotConfiguredError';
  }
}

/**
 * Restaurantkandidaten (alleen voor demo/lege staat). Bewust zonder verzonnen details:
 * omschrijving, prijsklasse en link vult de beheerder in na verificatie.
 */
export const firstEventVenues: Venue[] = [
  { id: 'heinde-utrecht', name: 'Heinde', city: 'Utrecht', cuisineTags: [] },
  { id: 'ixi-utrecht', name: 'IXI Restaurant', city: 'Utrecht', cuisineTags: [] },
];

export const emptyApi: PollApi = {
  getActiveEvent: async () => null,
  getEventBySlug: async () => null,
  getTally: async () => ({ participantCount: 0, dates: {}, venues: { none: 0 } }),
  listVenues: async () => firstEventVenues,
  castVote: async () => {
    throw new NotConfiguredError();
  },
  getMyVote: async () => ({ vote: null, lastDisplayName: null }),
  listVisits: async () => [],
};
