import type { PollEvent, PublicTally, Venue, VotePayload, VoteReceipt } from './types';

/**
 * Enige toegangspoort van de UI tot data. Fase A: `emptyApi` (geen backend).
 * Fase B voegt `supabaseApi` toe (publieke reads via RPC, writes via Edge Functions).
 */
export interface PollApi {
  /** Het open event, of null als er (nog) geen poll loopt. */
  getActiveEvent(): Promise<PollEvent | null>;
  getEventBySlug(slug: string): Promise<PollEvent | null>;
  getTally(eventId: string): Promise<PublicTally>;
  listVenues(): Promise<Venue[]>;
  submitVote(eventId: string, payload: VotePayload): Promise<VoteReceipt>;
}

export class NotConfiguredError extends Error {
  constructor() {
    super('Opslag is nog niet geconfigureerd.');
    this.name = 'NotConfiguredError';
  }
}

/**
 * Restaurantkandidaten voor het eerste etentje. Bewust zonder verzonnen details:
 * omschrijving, prijsklasse en link worden door de beheerder ingevuld na verificatie.
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
  submitVote: async () => {
    throw new NotConfiguredError();
  },
};

export const api: PollApi = emptyApi;
