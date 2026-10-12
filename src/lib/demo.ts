import { tallyVotes, type StoredVote } from './aggregate';
import { firstEventVenues } from './api';
import type { DateOption, PollEvent, PublicTally, VotePayload, VoteReceipt } from './types';

/**
 * ALLEEN voor `#/design`. Voorbeelddata om de UI te tonen; nooit als echte poll gebruiken.
 * Datums zijn relatief aan vandaag zodat de demo niet verouderd lijkt.
 */
function upcomingFridays(count: number): string[] {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7 || 7) + 14);
  return Array.from({ length: count }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() + i * 7);
    return x.toISOString().slice(0, 10);
  });
}

export function createDemo() {
  const dateOptions: DateOption[] = upcomingFridays(3).map((localDate, i) => ({
    id: `demo-d${i + 1}`,
    localDate,
    startTime: '18:30',
  }));
  const event: PollEvent = {
    id: 'demo',
    slug: 'demo',
    title: 'Voorbeeld-etentje',
    status: 'open',
    timezone: 'Europe/Amsterdam',
    dateOptions,
    venues: firstEventVenues,
    isDemo: true,
  };
  const [d1, d2, d3] = dateOptions.map((d) => d.id) as [string, string, string];
  const votes: StoredVote[] = [
    { availability: { [d1]: 'yes', [d2]: 'maybe', [d3]: 'no' }, venueChoice: 'heinde-utrecht' },
    { availability: { [d1]: 'yes', [d2]: 'yes', [d3]: 'maybe' }, venueChoice: 'ixi-utrecht' },
    { availability: { [d1]: 'maybe', [d2]: 'yes', [d3]: 'no' }, venueChoice: 'none' },
    { availability: { [d1]: 'yes', [d2]: 'no', [d3]: 'yes' }, venueChoice: 'heinde-utrecht' },
  ];
  const venueIds = event.venues.map((v) => v.id);
  return {
    event,
    getTally(): PublicTally {
      return tallyVotes(votes, dateOptions, venueIds);
    },
    async submitVote(_eventId: string, p: VotePayload): Promise<VoteReceipt> {
      await new Promise((r) => setTimeout(r, 500));
      votes.push({ availability: p.availability, venueChoice: p.venueChoice });
      return { editToken: 'demo-geen-echte-link' };
    },
  };
}
