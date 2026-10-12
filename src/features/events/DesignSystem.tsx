import { useMemo } from 'react';
import { createDemo } from '../../lib/demo';
import { firstEventVenues } from '../../lib/api';
import { ResultBar, VenueCard, EmptyState, RouteLine } from '../../components/ui';
import { VoteForm } from '../availability/VoteForm';
import { Results } from '../availability/Results';
import { useState } from 'react';
import type { PublicTally } from '../../lib/types';

const swatches = [
  ['night', '#0c1220', 'achtergrond'],
  ['ink', '#131b2e', 'vlakken'],
  ['line', '#2b3652', 'randen'],
  ['paper', '#f3efe6', 'tekst'],
  ['mist', '#a3acc2', 'secundair'],
  ['coral', '#ff5a4d', 'accent'],
  ['yes', '#5ed39b', 'ja'],
  ['maybe', '#f2b84b', 'misschien'],
  ['no', '#c98a93', 'nee'],
] as const;

export function DesignSystem() {
  const demo = useMemo(() => createDemo(), []);
  const [tally, setTally] = useState<PublicTally>(() => demo.getTally());

  return (
    <main id="main" className="mx-auto max-w-6xl px-5 pt-8">
      <p className="eyebrow">Design system</p>
      <h1 className="h-section mt-2 text-5xl">Kleur, type, componenten</h1>
      <p className="mt-4 max-w-xl text-mist">
        Alles op deze pagina is <strong className="text-paper">voorbeeld</strong>. De datums en
        stemmen zijn verzonnen demo-data, niet de echte poll.
      </p>

      <section className="mt-14" aria-labelledby="ds-colors">
        <h2 id="ds-colors" className="text-2xl">
          Kleuren
        </h2>
        <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {swatches.map(([name, hex, use]) => (
            <li key={name}>
              <div className="h-16 rounded-xl border border-line" style={{ background: hex }} />
              <p className="mt-2 text-sm font-semibold">{name}</p>
              <p className="text-xs text-mist">
                {hex} · {use}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="ds-type">
        <h2 id="ds-type" className="text-2xl">
          Typografie
        </h2>
        <p className="h-display mt-5">Display</p>
        <p className="mt-4 text-xl">Body: Instrument Sans. Rustig, goed leesbaar op de telefoon.</p>
        <p className="eyebrow mt-4">Eyebrow-label</p>
      </section>

      <section className="mt-14" aria-labelledby="ds-comp">
        <h2 id="ds-comp" className="text-2xl">
          Componenten
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary">Stem mee</button>
          <button className="btn">Secundair</button>
          <button className="btn" disabled>
            Uitgeschakeld
          </button>
          <span className="chip">Chip</span>
        </div>
        <div className="mt-6 max-w-md space-y-2">
          <ResultBar label="Ja" value={3} max={4} tone="yes" />
          <ResultBar label="Misschien" value={1} max={4} tone="maybe" />
        </div>
        <RouteLine className="mt-8 w-full max-w-xl" />
      </section>

      <section className="mt-14" aria-labelledby="ds-s1">
        <h2 id="ds-s1" className="text-2xl">
          Scherm 1 · Restaurantkaarten
        </h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {firstEventVenues.map((v, i) => (
            <VenueCard key={v.id} venue={v} index={i} />
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="ds-s2">
        <h2 id="ds-s2" className="text-2xl">
          Scherm 2 · Stemmen (demo)
        </h2>
        <p className="mb-5 mt-2 text-mist">Werkt echt in je browser, maar slaat niets op.</p>
        <VoteForm
          event={demo.event}
          onSubmit={(p) => demo.submitVote(demo.event.id, p)}
          onSaved={() => setTally(demo.getTally())}
        />
      </section>

      <section className="mt-14" aria-labelledby="ds-s3">
        <h2 id="ds-s3" className="text-2xl">
          Scherm 3 · Tussenstand en lege staat
        </h2>
        <div className="mt-6">
          <Results event={demo.event} tally={tally} />
        </div>
        <div className="mt-10">
          <EmptyState title="Nog niets vastgelegd">Zo ziet een lege geschiedenis eruit.</EmptyState>
        </div>
      </section>
    </main>
  );
}
