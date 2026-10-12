import { formatDateParts } from '../../lib/format';
import type { Visit } from '../../lib/types';

/**
 * Het routemotief als tijdlijn: eerdere etentjes als stippen op één lijn,
 * die doorloopt naar een pulserende stip voor "het volgende restaurant".
 */
export function Timeline({ visits, nextLabel }: { visits: Visit[]; nextLabel?: string }) {
  // Oud → nieuw, zodat de route richting "volgende" loopt.
  const ordered = [...visits].sort((a, b) => a.visitedOn.localeCompare(b.visitedOn));
  return (
    <ol
      className="relative ml-3 border-l-2 border-dashed border-line"
      aria-label="Eerdere etentjes"
    >
      {ordered.map((v, i) => {
        const d = formatDateParts(v.visitedOn);
        return (
          <li
            key={v.id}
            className="reveal relative pb-12 pl-8 sm:pl-12"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span
              className="absolute -left-[9px] top-2 h-4 w-4 rounded-full border-2 border-night bg-mist"
              aria-hidden="true"
            />
            <p className="eyebrow">
              Etentje {i + 1} · {d.long}
            </p>
            <h3 className="mt-2 text-3xl sm:text-4xl">{v.venue.name}</h3>
            <p className="mt-1 text-mist">
              {v.venue.city}
              {v.venue.cuisineTags.length > 0 && ` · ${v.venue.cuisineTags.join(' · ')}`}
            </p>
            {v.notes && <p className="mt-3 max-w-xl">{v.notes}</p>}
            {v.ratingSummary && (
              <p className="mt-3 text-sm text-mist">Groepswaardering {v.ratingSummary} / 5</p>
            )}
          </li>
        );
      })}
      <li className="relative pl-8 sm:pl-12">
        <span
          className="pulse-dot absolute -left-[11px] top-1.5 h-5 w-5 rounded-full bg-coral"
          aria-hidden="true"
        />
        <p className="eyebrow text-coral">Volgende</p>
        <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          {nextLabel ?? 'Nog te kiezen'}
        </p>
      </li>
    </ol>
  );
}
