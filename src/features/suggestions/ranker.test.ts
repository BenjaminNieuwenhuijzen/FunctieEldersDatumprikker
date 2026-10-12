import { describe, expect, it } from 'vitest';
import { seasonOf } from './cuisines';
import {
  describePlace,
  googleMapsUrl,
  rankPlaces,
  sameName,
  scorePlace,
  type DiscoverPlace,
  type RankContext,
} from './ranker';

const place = (over: Partial<DiscoverPlace>): DiscoverPlace => ({
  ref: 'node/1',
  name: 'Test',
  cuisines: ['italian'],
  lat: 52.0905,
  lon: 5.112,
  area: 'utrecht',
  ...over,
});

const ctx = (over: Partial<RankContext> = {}): RankContext => ({
  visited: [{ name: 'Daebak', cuisineTags: ['Koreaans', 'BBQ'], visitedOn: '2026-03-27' }],
  candidates: [{ name: 'Heinde' }, { name: 'IXI Restaurant' }],
  exclusions: ['FoodExplore', 'Daebak (Korean BBQ)', 'La Cubanita'],
  alreadySuggested: new Set(),
  tallies: {},
  today: new Date('2026-10-12T12:00:00Z'),
  ...over,
});

describe('sameName', () => {
  it('herkent varianten van dezelfde naam', () => {
    expect(sameName('Restaurant Carmel Market', 'Carmel Market')).toBe(true);
    expect(sameName('IXI Restaurant', 'IXI')).toBe(true); // "restaurant" telt niet mee
    expect(sameName('IXI', 'Pixie Bar')).toBe(false); // te kort voor een deelmatch
    expect(sameName('Daebak (Korean BBQ)', 'Daebak Korean BBQ')).toBe(true);
    expect(sameName('Umami', 'Miyagi and Jones')).toBe(false);
  });
});

describe('seasonOf', () => {
  it('bepaalt het seizoen in Europe/Amsterdam', () => {
    expect(seasonOf(new Date('2026-10-12T12:00:00Z'))).toBe('herfst');
    expect(seasonOf(new Date('2026-07-01T12:00:00Z'))).toBe('zomer');
    expect(seasonOf(new Date('2026-12-31T23:30:00Z'))).toBe('winter'); // 1 jan lokaal
  });
});

describe('scorePlace', () => {
  it('sluit uitgesloten restaurants en huidige kandidaten uit', () => {
    expect(scorePlace(place({ name: 'Daebak Korean BBQ' }), ctx(), 'herfst')).toBeNull();
    expect(scorePlace(place({ name: 'La Cubanita' }), ctx(), 'herfst')).toBeNull();
    expect(scorePlace(place({ name: 'Heinde' }), ctx(), 'herfst')).toBeNull();
  });

  it('sluit lunch- en snackzaken uit, ook met een tweede keuken', () => {
    expect(scorePlace(place({ cuisines: ['ice_cream'] }), ctx(), 'herfst')).toBeNull();
    expect(
      scorePlace(place({ cuisines: ['breakfast', 'coffee_shop', 'italian'] }), ctx(), 'herfst'),
    ).toBeNull();
  });

  it('zorgt voor afwisseling met de huidige kandidaten', () => {
    const c = ctx({ candidates: [{ name: 'IXI Restaurant', cuisines: ['asian', 'sushi'] }] });
    const sushi = scorePlace(place({ cuisines: ['sushi'] }), c, 'herfst')!;
    const greek = scorePlace(place({ cuisines: ['greek'] }), c, 'herfst')!;
    expect(sushi.reasons).toContain('Lijkt op kandidaat IXI Restaurant');
    expect(greek.reasons).toContain('Anders dan de huidige kandidaten');
  });

  it('waardeert een al bezochte keuken lager dan een nieuwe', () => {
    const korean = scorePlace(place({ cuisines: ['korean'] }), ctx(), 'herfst')!;
    const french = scorePlace(place({ cuisines: ['french'] }), ctx(), 'herfst')!;
    expect(french.score).toBeGreaterThan(korean.score);
    expect(korean.reasons.join()).toContain('Lijkt op een eerder etentje (Koreaans)');
    expect(french.reasons).toContain('Stevige, warme keuken voor de herfst');
  });

  it('geeft terras alleen extra punten in lente/zomer', () => {
    const p = place({ outdoorSeating: true, cuisines: ['vietnamese'] });
    const summer = scorePlace(p, ctx(), 'zomer')!;
    const autumn = scorePlace(p, ctx(), 'herfst')!;
    expect(summer.score).toBeGreaterThan(autumn.score);
    expect(summer.reasons).toContain('Terras: ideaal in de zomer');
  });

  it('laat stemmen meewegen', () => {
    const base = scorePlace(place({}), ctx(), 'herfst')!;
    const liked = scorePlace(
      place({}),
      ctx({ tallies: { 'node/1': { up: 3, down: 0 } } }),
      'herfst',
    )!;
    expect(liked.score).toBeGreaterThan(base.score);
    expect(liked.reasons).toContain('3 × lijkt me leuk');
  });
});

describe('rankPlaces', () => {
  it('beperkt tot twee per keukenfamilie en is deterministisch', () => {
    const places = [
      place({ ref: 'node/1', name: 'A', cuisines: ['italian'] }),
      place({ ref: 'node/2', name: 'B', cuisines: ['pizza'] }),
      place({ ref: 'node/3', name: 'C', cuisines: ['italian'] }),
      place({ ref: 'node/4', name: 'D', cuisines: ['french'] }),
    ];
    const r1 = rankPlaces(places, ctx());
    const r2 = rankPlaces(places, ctx());
    expect(r1.map((r) => r.place.ref)).toEqual(r2.map((r) => r.place.ref));
    expect(r1.filter((r) => ['italian', 'pizza'].includes(r.place.cuisines[0]!))).toHaveLength(2);
  });

  it('toont groepssuggesties niet dubbel', () => {
    const r = rankPlaces(
      [place({ ref: 'node/9' })],
      ctx({ alreadySuggested: new Set(['node/9']) }),
    );
    expect(r).toHaveLength(0);
  });
});

describe('describePlace / googleMapsUrl', () => {
  it('bouwt een feitelijke zin uit de gegevens', () => {
    expect(
      describePlace(
        place({
          cuisines: ['greek'],
          street: 'Oudegracht',
          housenumber: '12',
          city: 'Utrecht',
          outdoorSeating: true,
        }),
      ),
    ).toBe('Grieks restaurant, Oudegracht 12, Utrecht. Met terras.');
  });

  it('maakt een Google Maps-zoeklink zonder API-key', () => {
    const u = googleMapsUrl({ name: 'Carmel Market', street: 'Janskerkhof', city: 'Utrecht' });
    expect(u).toBe(
      'https://www.google.com/maps/search/?api=1&query=Carmel%20Market%2C%20Janskerkhof%2C%20Utrecht',
    );
  });
});
