import { describe, expect, it } from 'vitest';
import { rankDates, tallyVotes } from './aggregate';
import type { DateOption } from './types';

const dates: DateOption[] = [
  { id: 'a', localDate: '2030-01-10' },
  { id: 'b', localDate: '2030-01-17' },
];

describe('tallyVotes', () => {
  it('telt ja/misschien/nee per datum en restaurantkeuzes', () => {
    const t = tallyVotes(
      [
        { availability: { a: 'yes', b: 'maybe' }, venueChoice: 'v1' },
        { availability: { a: 'yes', b: 'no' }, venueChoice: 'none' },
        { availability: { a: 'maybe' }, venueChoice: 'v1' },
      ],
      dates,
      ['v1', 'v2'],
    );
    expect(t.participantCount).toBe(3);
    expect(t.dates.a).toEqual({ yes: 2, maybe: 1, no: 0 });
    expect(t.dates.b).toEqual({ yes: 0, maybe: 1, no: 1 });
    expect(t.venues).toEqual({ none: 1, v1: 2, v2: 0 });
  });

  it('negeert onbekende datums, antwoorden en restaurants', () => {
    const t = tallyVotes(
      [{ availability: { zzz: 'yes', a: 'bogus' as never }, venueChoice: 'onbekend' }],
      dates,
      ['v1'],
    );
    expect(t.dates.a).toEqual({ yes: 0, maybe: 0, no: 0 });
    expect(t.venues).toEqual({ none: 0, v1: 0 });
    expect(t.participantCount).toBe(1);
  });

  it('geeft lege tallen zonder stemmen', () => {
    expect(tallyVotes([], dates, []).participantCount).toBe(0);
  });
});

describe('rankDates', () => {
  it('sorteert op ja, dan misschien, dan datum', () => {
    const t = tallyVotes(
      [
        { availability: { a: 'maybe', b: 'yes' }, venueChoice: 'none' },
        { availability: { a: 'maybe', b: 'yes' }, venueChoice: 'none' },
      ],
      dates,
      [],
    );
    expect(rankDates(dates, t).map((d) => d.id)).toEqual(['b', 'a']);
  });
});
