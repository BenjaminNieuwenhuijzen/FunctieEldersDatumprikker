import { lazy, Suspense, useCallback, useMemo, useState, type FormEvent } from 'react';
import { EmailGate } from '../../components/EmailGate';
import { EmptyState } from '../../components/ui';
import { useSession } from '../../lib/auth';
import { api } from '../../lib/supabaseApi';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { isHttpUrl, LIMITS } from '../../lib/validators';
import { CuisineArt } from './CuisineArt';
import { cuisineKeyFromLabel, cuisineLabel, seasonOf } from './cuisines';
import { discoverApi, type GroupSuggestion, type Tally, type VoteTarget } from './discoverApi';
import { KIND_STYLE, type MapPoint } from './mapTypes';
import {
  describePlace,
  googleMapsUrl,
  rankPlaces,
  sameName,
  type DiscoverPlace,
  type Ranked,
} from './ranker';

const MapView = lazy(() => import('./MapView'));

const SEASON_LABEL = {
  lente: 'Lente',
  zomer: 'Zomer',
  herfst: 'Herfst',
  winter: 'Winter',
} as const;

/** Grove keukensleutel uit een vrij label ("Aziatische shared dining" → asian) voor de illustratie. */
function keyFromText(text = ''): string | undefined {
  const t = text.toLowerCase();
  const map: [RegExp, string][] = [
    [/azi|sushi|japan|korea|thai|viet|chin|wok|ramen/, 'asian'],
    [/ital|pizza|pasta/, 'italian'],
    [/tapas|mediterr|grieks|libanees|shared|delen|midden-oost/, 'mediterranean'],
    [/grill|bbq|steak|burger|vlees/, 'grill'],
    [/vega|groen|salade/, 'vegetarian'],
    [/indi|surinaams|mexic|peru|ethiop/, 'indian'],
  ];
  return map.find(([re]) => re.test(t))?.[1];
}

function VoteButtons({
  target,
  tally,
  mine,
  loggedIn,
  onVote,
  onNeedLogin,
}: {
  target: VoteTarget;
  tally?: Tally;
  mine?: 1 | -1;
  loggedIn: boolean;
  onVote: (target: VoteTarget, value: -1 | 0 | 1) => Promise<void>;
  onNeedLogin: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const click = async (v: 1 | -1) => {
    if (!loggedIn) return onNeedLogin();
    setBusy(true);
    try {
      await onVote(target, mine === v ? 0 : v);
    } finally {
      setBusy(false);
    }
  };
  const btn = (v: 1 | -1, label: string, icon: string, count: number) => (
    <button
      type="button"
      aria-pressed={mine === v}
      disabled={busy}
      onClick={() => void click(v)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
        mine === v
          ? v === 1
            ? 'border-yes bg-yes text-night'
            : 'border-no bg-no text-night'
          : 'border-line hover:border-mist'
      }`}
    >
      <span aria-hidden="true">{icon}</span> {label}
      <span className="tabular-nums opacity-80">{count}</span>
    </button>
  );
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Jouw reactie">
      {btn(1, 'Lijkt me leuk', '👍', tally?.up ?? 0)}
      {btn(-1, 'Lijkt me niks', '👎', tally?.down ?? 0)}
    </div>
  );
}

interface CardProps {
  name: string;
  cuisineText?: string;
  artKey?: string;
  story: string;
  priceNote?: string;
  reasons?: string[];
  badge: string;
  googleUrl: string;
  website?: string;
  hasMap: boolean;
  onShowOnMap: () => void;
  votes: React.ReactNode;
}

function PlaceCard(p: CardProps) {
  return (
    <article className="reveal flex flex-col gap-5 border-b border-line py-8 sm:flex-row">
      <CuisineArt name={p.name} cuisine={p.artKey} />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">
          {p.badge}
          {p.cuisineText && ` · ${p.cuisineText}`}
        </p>
        <h3 className="mt-1 text-3xl">{p.name}</h3>
        {p.priceNote && <p className="mt-1 font-semibold">{p.priceNote}</p>}
        <p className="mt-3 max-w-2xl">{p.story}</p>
        {p.reasons && p.reasons.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Waarom deze suggestie">
            {p.reasons.map((r) => (
              <li key={r} className="chip">
                {r}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <a
            href={p.googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-coral underline underline-offset-4"
          >
            ★ Google-reviews bekijken ↗
          </a>
          {p.website && (
            <a
              href={p.website}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Website ↗
            </a>
          )}
          {p.hasMap && (
            <button type="button" onClick={p.onShowOnMap} className="underline underline-offset-4">
              Toon op kaart
            </button>
          )}
        </div>
        <div className="mt-4">{p.votes}</div>
      </div>
    </article>
  );
}

function SuggestForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setMsg({ ok: false, text: 'Geef je idee een naam.' });
    if (url.trim() && !isHttpUrl(url.trim()))
      return setMsg({ ok: false, text: 'Gebruik een link die met https:// begint.' });
    setBusy(true);
    try {
      await discoverApi.submit(name.trim(), reason.trim(), url.trim(), label.trim());
      setMsg({
        ok: true,
        text: 'Dank je! De beheerder bekijkt je idee; daarna verschijnt het hier.',
      });
      setName('');
      setReason('');
      setUrl('');
      onDone();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <label className="text-sm">
        Naam restaurant
        <input
          className="field mt-1"
          maxLength={LIMITS.suggestionName}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="text-sm">
        Jouw naam (optioneel, publiek)
        <input
          className="field mt-1"
          maxLength={LIMITS.name}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Waarom past het bij ons?
        <input
          className="field mt-1"
          maxLength={LIMITS.reason}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Link (optioneel)
        <input
          className="field mt-1"
          inputMode="url"
          maxLength={LIMITS.url}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>
      <div className="sm:col-span-2">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Versturen…' : 'Idee insturen'}
        </button>
        {msg && (
          <p
            className={`mt-3 ${msg.ok ? 'text-yes' : 'error-text'}`}
            role={msg.ok ? 'status' : 'alert'}
          >
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}

export function Discover() {
  const session = useSession();
  const loggedIn = session.status === 'ready' && !!session.session;
  const [version, setVersion] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [filter, setFilter] = useState<'all' | 'group' | 'auto'>('all');

  const data = useAsync(async () => {
    const [places, meta, suggestions, tallies, visits, venues] = await Promise.all([
      discoverApi.places(),
      discoverApi.meta(),
      discoverApi.suggestions(),
      discoverApi.tallies(),
      api.listVisits(),
      api.listVenues(),
    ]);
    return { places, meta, suggestions, tallies, visits, venues };
  }, [version]);

  const mine = useAsync(
    async () => (loggedIn ? discoverApi.myVotes() : ({} as Record<string, 1 | -1>)),
    [loggedIn, version],
  );
  const [localTallies, setLocalTallies] = useState<Record<string, Tally>>({});
  const [localMine, setLocalMine] = useState<Record<string, 1 | -1 | undefined>>({});

  const onVote = useCallback(async (target: VoteTarget, value: -1 | 0 | 1) => {
    const t = await discoverApi.vote(target, value);
    setLocalTallies((s) => ({ ...s, [target]: t }));
    setLocalMine((s) => ({ ...s, [target]: value === 0 ? undefined : value }));
  }, []);

  const derived = useMemo(() => {
    if (data.status !== 'ready') return null;
    const { places, meta, suggestions, tallies, visits, venues } = data.data;
    const byRef = new Map(places.map((p) => [p.ref, p]));
    const placeTallies: Record<string, Tally> = {};
    for (const [k, v] of Object.entries({ ...tallies, ...localTallies }))
      if (k.startsWith('place:')) placeTallies[k.slice(6)] = v;
    const ranked: Ranked[] = rankPlaces(places, {
      visited: visits.map((v) => ({
        name: v.venue.name,
        cuisineTags: v.venue.cuisineTags,
        visitedOn: v.visitedOn,
      })),
      candidates: venues.map((v) => ({
        name: v.name,
        cuisines:
          places.find((p) => sameName(p.name, v.name))?.cuisines ??
          v.cuisineTags.map((t) => cuisineKeyFromLabel(t)).filter((k): k is string => !!k),
      })),
      exclusions: meta.exclusions,
      alreadySuggested: new Set(suggestions.map((s) => s.osmRef).filter((r): r is string => !!r)),
      tallies: placeTallies,
      today: new Date(),
    });

    const findPlace = (name: string) => places.find((p) => sameName(p.name, name));
    const points: MapPoint[] = [];
    for (const s of suggestions) {
      if (s.lat == null || s.lon == null) continue;
      points.push({
        id: `suggestion:${s.id}`,
        lat: s.lat,
        lon: s.lon,
        name: s.name,
        subtitle: s.cuisineLabel,
        kind: 'group',
        googleUrl: suggestionGoogle(s, byRef),
      });
    }
    for (const r of ranked) {
      points.push({
        id: `place:${r.place.ref}`,
        lat: r.place.lat,
        lon: r.place.lon,
        name: r.place.name,
        subtitle: r.place.cuisines.map(cuisineLabel).join(', '),
        kind: 'auto',
        googleUrl: googleMapsUrl(r.place),
      });
    }
    for (const v of venues) {
      const p = findPlace(v.name);
      const lat = v.lat ?? p?.lat;
      const lon = v.lon ?? p?.lon;
      if (lat != null && lon != null)
        points.push({
          id: `cand:${v.id}`,
          lat,
          lon,
          name: v.name,
          subtitle: 'Kandidaat volgend etentje',
          kind: 'candidate',
          googleUrl: googleMapsUrl(p ?? { name: v.name, city: v.city }),
        });
    }
    for (const v of visits) {
      const p = findPlace(v.venue.name);
      if (p)
        points.push({
          id: `visit:${v.id}`,
          lat: p.lat,
          lon: p.lon,
          name: v.venue.name,
          subtitle: 'Al bezocht',
          kind: 'visited',
          googleUrl: googleMapsUrl(p),
        });
    }
    return { ranked, points, suggestions, byRef, tallies: { ...tallies, ...localTallies }, meta };
  }, [data, localTallies]);

  const showOnMap = (id: string) => {
    setFocusId(null);
    requestAnimationFrame(() => setFocusId(id));
    document
      .getElementById('ontdek-kaart')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const myVote = (t: VoteTarget): 1 | -1 | undefined =>
    t in localMine ? localMine[t] : mine.status === 'ready' ? mine.data[t] : undefined;
  const needLogin = () => {
    setShowLogin(true);
    requestAnimationFrame(() =>
      document
        .getElementById('ontdek-login')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  };

  const season = SEASON_LABEL[seasonOf(new Date())];

  return (
    <main id="main" className="mx-auto max-w-5xl px-5 pt-8">
      <p className="eyebrow">Ontdek · {season}</p>
      <h1 className="h-section mt-2 text-4xl">De volgende plek</h1>
      <p className="mt-4 max-w-2xl text-mist">
        Ideeën van de groep en automatische suggesties, elke dag opnieuw berekend op basis van waar
        we al waren, de huidige kandidaten en het seizoen. Stem met 👍 of 👎: één stem per persoon
        per plek, los van de formele stemming voor een etentje.
      </p>

      {data.status === 'loading' && <Loading />}
      {data.status === 'error' && <ErrorNote message={data.message} />}
      {derived && (
        <>
          <section className="mt-10" aria-labelledby="kaart-h" id="ontdek-kaart">
            <h2 id="kaart-h" className="sr-only">
              Kaart
            </h2>
            <Suspense
              fallback={<div className="h-[22rem] rounded-3xl border border-line sm:h-[28rem]" />}
            >
              <MapView points={derived.points} focusId={focusId} />
            </Suspense>
            <ul
              className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-mist"
              aria-label="Legenda"
            >
              {Object.entries(KIND_STYLE).map(([k, s]) => (
                <li key={k} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden="true"
                  />
                  {s.label}
                </li>
              ))}
            </ul>
          </section>

          {!loggedIn && (
            <div id="ontdek-login" className="mt-10">
              {showLogin ? (
                <EmailGate intro="Bevestig je e-mailadres om te stemmen of een idee in te sturen. Je stemt één keer per plek." />
              ) : (
                <p className="rounded-2xl border border-line p-4 text-mist">
                  Wil je stemmen of een idee insturen?{' '}
                  <button
                    type="button"
                    className="font-semibold text-paper underline underline-offset-4"
                    onClick={() => setShowLogin(true)}
                  >
                    Log in met je e-mail
                  </button>
                  .
                </p>
              )}
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filter suggesties">
            {(
              [
                ['all', 'Alles'],
                ['group', `Van de groep (${derived.suggestions.length})`],
                ['auto', `Automatisch (${derived.ranked.length})`],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                className={`btn ${filter === k ? 'btn-primary' : ''}`}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>

          {filter !== 'auto' && (
            <section className="mt-6" aria-labelledby="groep-h">
              <h2 id="groep-h" className="text-2xl">
                Suggesties van de groep
              </h2>
              {derived.suggestions.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title="Nog geen ideeën">
                    Stuur hieronder het eerste idee in.
                  </EmptyState>
                </div>
              ) : (
                [...derived.suggestions]
                  .sort(
                    (a, b) =>
                      net(derived.tallies[`suggestion:${b.id}`]) -
                      net(derived.tallies[`suggestion:${a.id}`]),
                  )
                  .map((s) => {
                    const target: VoteTarget = `suggestion:${s.id}`;
                    const place = s.osmRef ? derived.byRef.get(s.osmRef) : undefined;
                    return (
                      <PlaceCard
                        key={s.id}
                        name={s.name}
                        cuisineText={s.cuisineLabel ?? place?.cuisines.map(cuisineLabel).join(', ')}
                        artKey={place?.cuisines[0] ?? keyFromText(s.cuisineLabel)}
                        story={s.reason ?? (place ? describePlace(place) : 'Idee van de groep.')}
                        priceNote={s.priceNote}
                        badge={
                          s.source === 'admin'
                            ? 'Tip van de beheerder'
                            : `Idee van ${s.submittedBy ?? 'de groep'}`
                        }
                        googleUrl={suggestionGoogle(s, derived.byRef)}
                        website={s.url && isHttpUrl(s.url) ? s.url : place?.website}
                        hasMap={s.lat != null}
                        onShowOnMap={() => showOnMap(target)}
                        votes={
                          <VoteButtons
                            target={target}
                            tally={derived.tallies[target]}
                            mine={myVote(target)}
                            loggedIn={loggedIn}
                            onVote={onVote}
                            onNeedLogin={needLogin}
                          />
                        }
                      />
                    );
                  })
              )}
            </section>
          )}

          {filter !== 'group' && (
            <section className="mt-12" aria-labelledby="auto-h">
              <h2 id="auto-h" className="text-2xl">
                Automatisch gevonden
              </h2>
              <p className="mt-2 text-sm text-mist">
                Gerangschikt op: nieuw voor de groep, afwisseling met eerdere etentjes en de
                kandidaten, het seizoen ({season.toLowerCase()}), bereikbaarheid en jullie stemmen.
              </p>
              {derived.ranked.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title="De catalogus wordt nog gevuld">
                    Elke nacht worden restaurants rond Utrecht Centraal en Vianen opgehaald uit
                    OpenStreetMap. Kom morgen terug.
                  </EmptyState>
                </div>
              ) : (
                derived.ranked.map((r) => {
                  const target: VoteTarget = `place:${r.place.ref}`;
                  return (
                    <PlaceCard
                      key={r.place.ref}
                      name={r.place.name}
                      cuisineText={r.place.cuisines.map(cuisineLabel).join(', ') || undefined}
                      artKey={r.place.cuisines[0]}
                      story={describePlace(r.place)}
                      reasons={r.reasons}
                      badge="Automatische suggestie"
                      googleUrl={googleMapsUrl(r.place)}
                      website={r.place.website}
                      hasMap
                      onShowOnMap={() => showOnMap(target)}
                      votes={
                        <VoteButtons
                          target={target}
                          tally={derived.tallies[target]}
                          mine={myVote(target)}
                          loggedIn={loggedIn}
                          onVote={onVote}
                          onNeedLogin={needLogin}
                        />
                      }
                    />
                  );
                })
              )}
            </section>
          )}

          <section
            className="mt-14 rounded-3xl border border-line bg-ink p-5 sm:p-8"
            aria-labelledby="idee-h"
          >
            <h2 id="idee-h" className="text-2xl">
              Zelf een idee?
            </h2>
            <p className="mt-2 text-mist">
              Ideeën verschijnen hier nadat de beheerder ze heeft bekeken.
            </p>
            <div className="mt-5">
              {loggedIn ? (
                <SuggestForm onDone={() => setVersion((v) => v + 1)} />
              ) : (
                <button type="button" className="btn" onClick={needLogin}>
                  Log in om een idee in te sturen
                </button>
              )}
            </div>
          </section>

          <p className="mt-8 text-xs text-mist">
            Restaurantgegevens: © OpenStreetMap-bijdragers (ODbL)
            {derived.meta.updatedAt &&
              `, bijgewerkt ${new Date(derived.meta.updatedAt).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long' })}`}
            . Kaart: © OpenStreetMap. Sterren en reviews staan op Google; de kaart laadt tegels van
            OpenStreetMap, die daarbij je IP-adres ziet. Prijzen bij tips van de beheerder zijn
            indicatief.
          </p>
        </>
      )}
    </main>
  );
}

const net = (t?: Tally) => (t ? t.up - t.down : 0);

function suggestionGoogle(s: GroupSuggestion, byRef: Map<string, DiscoverPlace>) {
  const p = s.osmRef ? byRef.get(s.osmRef) : undefined;
  return googleMapsUrl(p ?? { name: s.name, city: 'Utrecht' });
}
