// Haalt dagelijks restaurants rond Utrecht Centraal en Vianen op uit OpenStreetMap (Overpass API)
// en slaat ze op in public.discover_places. Wordt aangeroepen door pg_cron (zie migration
// discover_schedule). Publiek aanroepbaar, maar draait hooguit eens per 20 uur: misbruik kan dus
// geen extra verkeer naar Overpass of extra databasewerk veroorzaken.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Volgorde: snelste eerst. Per server max. 40 s, zodat drie pogingen binnen de 150 s-limiet
// van Supabase Edge Functions passen.
const SERVERS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA =
  'FunctieElders-Datumprikker/1.0 (github.com/BenjaminNieuwenhuijzen/FunctieEldersDatumprikker)';
const AREAS = [
  { area: 'utrecht', lat: 52.0894, lon: 5.11, radius: 4000 }, // Utrecht Centraal
  { area: 'vianen', lat: 51.9925, lon: 5.0919, radius: 2500 }, // Vianen centrum
] as const;
const QUERY = `[out:json][timeout:35];(${AREAS.map(
  (a) => `nwr["amenity"="restaurant"]["name"](around:${a.radius},${a.lat},${a.lon});`,
).join('')});out center tags;`;

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function distKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(bLat - aLat) / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const yes = (v?: string) => (v === 'yes' || v === 'only' ? true : v === 'no' ? false : undefined);

function toPlace(e: OsmElement) {
  const t = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (!t.name || lat == null || lon == null) return null;
  const nearest = AREAS.map((a) => ({ a, d: distKm(lat, lon, a.lat, a.lon) })).sort(
    (x, y) => x.d - y.d,
  )[0]!;
  const website = t.website ?? t['contact:website'];
  const diets = ['vegetarian', 'vegan', 'halal', 'gluten_free'].filter((k) =>
    ['yes', 'only'].includes(t[`diet:${k}`] ?? ''),
  );
  return {
    ref: `${e.type}/${e.id}`,
    name: t.name,
    cuisines: (t.cuisine ?? '')
      .split(';')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6),
    lat,
    lon,
    street: t['addr:street'],
    housenumber: t['addr:housenumber'],
    postcode: t['addr:postcode'],
    city: t['addr:city'],
    website: website && /^https?:\/\//i.test(website) ? website : undefined,
    outdoorSeating: yes(t.outdoor_seating),
    wheelchair: t.wheelchair,
    diets,
    openingHours: t.opening_hours,
    area: nearest.a.area,
  };
}

async function fetchOverpass(): Promise<{ elements: OsmElement[]; source: string }> {
  const errors: string[] = [];
  for (const url of SERVERS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(40_000),
      });
      const text = await res.text();
      if (!res.ok || !text.startsWith('{'))
        throw new Error(
          `HTTP ${res.status} ${text
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 80)}`,
        );
      const json = JSON.parse(text) as { elements?: OsmElement[] };
      if (!json.elements?.length) throw new Error('lege respons');
      return { elements: json.elements, source: new URL(url).host };
    } catch (e) {
      errors.push(`${new URL(url).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'geen Overpass-server bereikbaar');
}

Deno.serve(async () => {
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  );
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const { data: shouldRun } = await db.rpc('discover_should_run', { p_min_hours: 20 });
  if (!shouldRun) return json(200, { status: 'skipped' });

  const { data: runId, error: startErr } = await db.rpc('discover_start_run');
  if (startErr) return json(500, { status: 'error' });

  try {
    const { elements, source } = await fetchOverpass();
    const places = elements.map(toPlace).filter(Boolean);
    const { data: n, error } = await db.rpc('discover_finish_run', {
      p_run_id: runId,
      p_status: 'ok',
      p_places: places,
      p_source: source,
      p_message: null,
    });
    if (error) throw new Error('opslaan mislukt');
    return json(200, { status: 'ok', places: n, source });
  } catch (e) {
    await db.rpc('discover_finish_run', {
      p_run_id: runId,
      p_status: 'error',
      p_places: null,
      p_source: null,
      p_message: (e as Error).message.slice(0, 400),
    });
    return json(502, { status: 'error' });
  }
});
