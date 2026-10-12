import {
  NOT_FOR_DINNER,
  SEASON_FIT,
  SHAREABLE,
  cuisineFamily,
  cuisineKeyFromLabel,
  cuisineLabel,
  seasonOf,
  type Season,
} from './cuisines';

/** Restaurant uit de OSM-catalogus (zie get_discover_places). */
export interface DiscoverPlace {
  ref: string;
  name: string;
  cuisines: string[];
  lat: number;
  lon: number;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  website?: string;
  outdoorSeating?: boolean;
  wheelchair?: string;
  diets?: string[];
  openingHours?: string;
  area: 'utrecht' | 'vianen';
}

export interface RankContext {
  /** Eerder bezochte restaurants (naam + keukenlabels zoals in de catalogus). */
  visited: { name: string; cuisineTags: string[]; visitedOn: string }[];
  /** Restaurants die nu al in de stemming staan (keukens uit OSM, indien gevonden). */
  candidates: { name: string; cuisines?: string[] }[];
  /** Voor het komende etentje uitgesloten (labels). */
  exclusions: string[];
  /** OSM-refs die al als groepssuggestie getoond worden (niet dubbel tonen). */
  alreadySuggested: Set<string>;
  /** Stemmen per OSM-ref (👍/👎). */
  tallies: Record<string, { up: number; down: number }>;
  today: Date;
}

export interface Ranked {
  place: DiscoverPlace;
  score: number;
  reasons: string[];
}

export const UTRECHT_CS = { lat: 52.0894, lon: 5.11 };

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Lopen in een stad: ~4,5 km/u met een omwegfactor van 1,3. */
export const walkMinutes = (km: number) => Math.round(((km * 1.3) / 4.5) * 60);

/** Naam normaliseren voor vergelijken ("Restaurant Carmel Market" ≈ "Carmel Market"). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(restaurant|utrecht|vianen|the|de|het)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function sameName(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.includes(short);
}

function cuisineKeysOfVisit(tags: string[]): string[] {
  return tags.map((t) => cuisineKeyFromLabel(t) ?? t.toLowerCase());
}

/**
 * Deterministische, uitlegbare score. Elke bijdrage levert (indien relevant) een zichtbare reden.
 * Exporteerbaar en getest; geen willekeur, geen externe AI.
 */
export function scorePlace(place: DiscoverPlace, ctx: RankContext, season: Season): Ranked | null {
  if (ctx.alreadySuggested.has(place.ref)) return null;
  if (ctx.exclusions.some((x) => sameName(x, place.name))) return null;
  if (ctx.candidates.some((c) => sameName(c.name, place.name))) return null;
  const keys = place.cuisines;
  // Hoofdkeuken ontbijt/lunch/snack (bijv. "breakfast;coffee_shop;italian"): geen avondetentje.
  if (keys[0] && NOT_FOR_DINNER.has(keys[0])) return null;

  let score = 0;
  const reasons: string[] = [];

  const visit = ctx.visited.find((v) => sameName(v.name, place.name));
  if (visit) {
    score -= 6;
    reasons.push('Al eerder bezocht');
  } else {
    score += 2;
    reasons.push('Nieuw voor de groep');
  }

  if (keys.length === 0) {
    score -= 2;
  } else {
    const visitedKeys = new Set(ctx.visited.flatMap((v) => cuisineKeysOfVisit(v.cuisineTags)));
    const overlap = keys.find((k) => visitedKeys.has(k));
    if (overlap) {
      score -= 2;
      reasons.push(`Lijkt op een eerder etentje (${cuisineLabel(overlap)})`);
    } else {
      score += 1.5;
      reasons.push(`Nieuwe keuken: ${cuisineLabel(keys[0]!)}`);
    }
    const similar = ctx.candidates.find((c) => c.cuisines?.some((k) => keys.includes(k)));
    if (similar) {
      score -= 1;
      reasons.push(`Lijkt op kandidaat ${similar.name}`);
    } else if (ctx.candidates.some((c) => c.cuisines?.length)) {
      score += 0.5;
      reasons.push('Anders dan de huidige kandidaten');
    }
    const fit = SEASON_FIT[season];
    if (keys.some((k) => fit.keys.includes(k))) {
      score += 1.5;
      reasons.push(fit.reason);
    }
    if (keys.some((k) => SHAREABLE.has(k))) {
      score += 0.75;
      reasons.push('Leuk om samen te delen');
    }
  }

  if (place.outdoorSeating && (season === 'zomer' || season === 'lente')) {
    score += season === 'zomer' ? 2 : 1;
    reasons.push(season === 'zomer' ? 'Terras: ideaal in de zomer' : 'Heeft een terras');
  }

  if (place.area === 'utrecht') {
    const km = distanceKm(place, UTRECHT_CS);
    if (km <= 1.3) {
      score += 1.5;
      reasons.push(`${walkMinutes(km)} min lopen van Utrecht Centraal`);
    } else if (km <= 2.5) {
      score += 0.5;
    } else {
      score -= 0.5;
    }
  } else {
    score += 0.75;
    reasons.push('In Vianen');
  }

  if (place.diets?.includes('vegetarian') || place.diets?.includes('vegan')) {
    score += 0.5;
    reasons.push('Vegetarische opties');
  }
  if (place.wheelchair === 'yes') score += 0.25;
  if (place.website) score += 0.5;
  if (place.openingHours) score += 0.25;

  const t = ctx.tallies[place.ref];
  if (t) {
    const net = t.up - t.down;
    score += net * 0.75;
    if (t.up > 0) reasons.push(`${t.up} × lijkt me leuk`);
  }

  return { place, score: Math.round(score * 100) / 100, reasons };
}

/**
 * Rangschikt de catalogus en kiest een gevarieerde top: hooguit twee per keukenfamilie,
 * zodat de lijst niet uit alleen pizza of sushi bestaat.
 */
export function rankPlaces(places: DiscoverPlace[], ctx: RankContext, limit = 12): Ranked[] {
  const season = seasonOf(ctx.today);
  const scored = places
    .map((p) => scorePlace(p, ctx, season))
    .filter((r): r is Ranked => r !== null)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name));
  const perFamily = new Map<string, number>();
  const out: Ranked[] = [];
  for (const r of scored) {
    const fam = cuisineFamily(r.place.cuisines[0]);
    const n = perFamily.get(fam) ?? 0;
    if (n >= 2) continue;
    perFamily.set(fam, n + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** Feitelijke korte beschrijving, opgebouwd uit OSM-gegevens (geen verzonnen tekst). */
export function describePlace(p: DiscoverPlace): string {
  const kind = p.cuisines.length
    ? `${p.cuisines.slice(0, 2).map(cuisineLabel).join(' en ')} restaurant`
    : 'Restaurant';
  const address = [p.street && `${p.street}${p.housenumber ? ` ${p.housenumber}` : ''}`, p.city]
    .filter(Boolean)
    .join(', ');
  const extras = [
    p.outdoorSeating && 'terras',
    p.diets?.includes('vegan')
      ? 'veganistische opties'
      : p.diets?.includes('vegetarian') && 'vegetarische opties',
    p.wheelchair === 'yes' && 'rolstoeltoegankelijk',
  ].filter(Boolean);
  return `${kind}${address ? `, ${address}` : ''}.${extras.length ? ` Met ${extras.join(', ')}.` : ''}`;
}

/** Link naar de Google Maps-pagina van de plek, met sterren en reviews. Geen API-key nodig. */
export function googleMapsUrl(p: {
  name: string;
  street?: string;
  housenumber?: string;
  city?: string;
  area?: string;
}) {
  const q = [
    p.name,
    p.street && `${p.street} ${p.housenumber ?? ''}`.trim(),
    p.city ?? (p.area === 'vianen' ? 'Vianen' : 'Utrecht'),
  ]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
