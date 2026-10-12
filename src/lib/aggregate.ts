import type { Answer, DateOption, PublicTally, VenueChoice } from './types';

export interface StoredVote {
  availability: Record<string, Answer>;
  venueChoice: VenueChoice;
}

/** Telt stemmen op tot publieke aantallen. Eén stem per deelnemer, onbekende opties worden genegeerd. */
export function tallyVotes(
  votes: StoredVote[],
  dateOptions: DateOption[],
  venueIds: string[],
): PublicTally {
  const dates: PublicTally['dates'] = {};
  for (const d of dateOptions) dates[d.id] = { yes: 0, maybe: 0, no: 0 };
  const venues: PublicTally['venues'] = { none: 0 };
  for (const id of venueIds) venues[id] = 0;

  for (const vote of votes) {
    for (const [dateId, answer] of Object.entries(vote.availability)) {
      const bucket = dates[dateId];
      if (bucket && (answer === 'yes' || answer === 'maybe' || answer === 'no')) bucket[answer]++;
    }
    if (vote.venueChoice in venues) venues[vote.venueChoice] = (venues[vote.venueChoice] ?? 0) + 1;
  }
  return { participantCount: votes.length, dates, venues };
}

/** Sorteert datums: eerst meeste "ja", dan meeste "misschien", dan chronologisch. */
export function rankDates(dateOptions: DateOption[], tally: PublicTally): DateOption[] {
  return [...dateOptions].sort((a, b) => {
    const ta = tally.dates[a.id] ?? { yes: 0, maybe: 0, no: 0 };
    const tb = tally.dates[b.id] ?? { yes: 0, maybe: 0, no: 0 };
    return tb.yes - ta.yes || tb.maybe - ta.maybe || a.localDate.localeCompare(b.localDate);
  });
}
