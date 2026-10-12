export type Answer = 'yes' | 'maybe' | 'no';
export type EventStatus = 'draft' | 'open' | 'closed' | 'completed';

/** Waarde voor de restaurantkeuze "geen voorkeur" (geen fictief restaurant). */
export const NO_PREFERENCE = 'none' as const;
export type VenueChoice = string | typeof NO_PREFERENCE;

export interface DateOption {
  id: string;
  /** Lokale kalenderdatum, YYYY-MM-DD (bewust geen timestamp: voorkomt DST-fouten). */
  localDate: string;
  /** Lokale starttijd, HH:MM, optioneel. */
  startTime?: string;
  label?: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  cuisineTags: string[];
  websiteUrl?: string;
  description?: string;
  /** 1 (€) t/m 4 (€€€€). Alleen invullen als bekend. */
  priceBand?: 1 | 2 | 3 | 4;
  /** ISO-tijdstip waarop de gegevens door de beheerder zijn geverifieerd. */
  verifiedAt?: string;
  lat?: number;
  lon?: number;
}

export interface PollEvent {
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  timezone: string;
  /** Fase 2: de beheerder heeft het restaurant vastgelegd en de datumprikker geopend. */
  datesOpen: boolean;
  /** Gekozen restaurant (alleen bekend zodra de datumprikker open is). */
  decidedVenue?: Venue | null;
  /** Leeg zolang de datumprikker op slot zit. */
  dateOptions: DateOption[];
  venues: Venue[];
  /** Voor de UI: toon "voorbeeld" bij demo-data. */
  isDemo?: boolean;
}

export interface DateTally {
  yes: number;
  maybe: number;
  no: number;
}

/** Enige stemdata die publiek mag zijn: aantallen, nooit namen of individuele antwoorden. */
export interface PublicTally {
  participantCount: number;
  dates: Record<string, DateTally>;
  venues: Record<string, number>;
}

export interface VotePayload {
  displayName: string;
  availability: Record<string, Answer>;
  venueChoice: VenueChoice;
  suggestion?: { name: string; reason: string; url?: string };
}

/** Bevestigd bezoek (historie). */
export interface Visit {
  id: string;
  visitedOn: string;
  notes?: string;
  ratingSummary?: number;
  venue: Venue;
}
