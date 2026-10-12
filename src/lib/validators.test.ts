import { describe, expect, it } from 'vitest';
import { validateVote } from './validators';
import type { DateOption } from './types';

const dates: DateOption[] = [{ id: 'a', localDate: '2030-01-10' }];

describe('validateVote', () => {
  it('accepteert een geldige stem', () => {
    expect(
      validateVote({ displayName: 'Sam', availability: { a: 'yes' }, venueChoice: 'none' }, dates, [
        'v1',
      ]),
    ).toEqual({});
  });

  it('weigert lege naam, geen antwoorden en onbekend restaurant', () => {
    const e = validateVote({ displayName: ' ', availability: {}, venueChoice: 'x' }, dates, ['v1']);
    expect(Object.keys(e).sort()).toEqual(['availability', 'name', 'venue']);
  });

  it('negeert antwoorden op onbekende datums', () => {
    const e = validateVote(
      { displayName: 'Sam', availability: { zzz: 'yes' }, venueChoice: 'v1' },
      dates,
      ['v1'],
    );
    expect(e.availability).toBeDefined();
  });

  it('weigert niet-http(s) links in een suggestie', () => {
    const e = validateVote(
      {
        displayName: 'Sam',
        availability: { a: 'maybe' },
        venueChoice: 'v1',
        suggestion: { name: 'Plek', reason: '', url: 'javascript:alert(1)' },
      },
      dates,
      ['v1'],
    );
    expect(e.suggestion).toBeDefined();
  });

  it('laat een lege suggestie door', () => {
    const e = validateVote(
      {
        displayName: 'Sam',
        availability: { a: 'no' },
        venueChoice: 'v1',
        suggestion: { name: '', reason: '', url: '' },
      },
      dates,
      ['v1'],
    );
    expect(e).toEqual({});
  });

  it('vraagt in fase 1 alleen een restaurant en in fase 2 alleen datums', () => {
    const venueOnly = { displayName: 'Sam', availability: {}, venueChoice: 'v1' };
    expect(validateVote(venueOnly, dates, ['v1'], 'venue')).toEqual({});
    expect(validateVote(venueOnly, dates, ['v1'], 'dates').availability).toBeDefined();
    const datesOnly = { displayName: 'Sam', availability: { a: 'yes' as const }, venueChoice: '' };
    expect(validateVote(datesOnly, dates, ['v1'], 'dates')).toEqual({});
    expect(validateVote(datesOnly, dates, ['v1'], 'venue').venue).toBeDefined();
  });
});
