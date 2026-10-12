import { ResultBar } from '../../components/ui';
import { capFirst, formatDateParts } from '../../lib/format';
import type { PollEvent, PublicTally } from '../../lib/types';

/** Geaggregeerde tussenstand. Toont nooit namen of individuele antwoorden. */
export function Results({ event, tally }: { event: PollEvent; tally: PublicTally }) {
  const maxDate = Math.max(1, tally.participantCount);
  const maxVenue = Math.max(1, ...Object.values(tally.venues));
  const counter = (
    <p className="mt-2 text-mist" aria-live="polite">
      {tally.participantCount === 0
        ? 'Nog niemand heeft gestemd.'
        : `${tally.participantCount} ${tally.participantCount === 1 ? 'deelnemer heeft' : 'deelnemers hebben'} gestemd.`}
    </p>
  );

  const venues = (
    <div>
      <h3 id={event.datesOpen ? undefined : 'results-h'} className="h-section">
        {event.datesOpen ? 'Uitslag restaurant' : 'Tussenstand restaurant'}
      </h3>
      {!event.datesOpen && counter}
      <div className="mt-6 space-y-2">
        {event.venues.map((v) => (
          <ResultBar
            key={v.id}
            label={v.name}
            value={tally.venues[v.id] ?? 0}
            max={maxVenue}
            highlight={event.decidedVenue?.id === v.id}
          />
        ))}
        <ResultBar
          label="Geen voorkeur"
          value={tally.venues.none ?? 0}
          max={maxVenue}
          tone="mist"
        />
      </div>
    </div>
  );

  if (!event.datesOpen) {
    return (
      <section aria-labelledby="results-h" className="grid gap-10 md:grid-cols-2">
        {venues}
        <div className="rounded-3xl border border-dashed border-line p-6">
          <h3 className="text-2xl">Beschikbaarheid</h3>
          <p className="mt-2 text-mist">
            Volgt zodra het restaurant gekozen is en de datumprikker opengaat.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="results-h" className="grid gap-10 md:grid-cols-2">
      <div>
        <h3 id="results-h" className="h-section">
          Beschikbaarheid
        </h3>
        {counter}
        <ul className="mt-6 space-y-6">
          {event.dateOptions.map((d) => {
            const t = tally.dates[d.id] ?? { yes: 0, maybe: 0, no: 0 };
            return (
              <li key={d.id}>
                <p className="mb-2 font-semibold">{capFirst(formatDateParts(d.localDate).short)}</p>
                <div className="space-y-1.5">
                  <ResultBar label="Ja" value={t.yes} max={maxDate} tone="yes" />
                  <ResultBar label="Misschien" value={t.maybe} max={maxDate} tone="maybe" />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {venues}
    </section>
  );
}
