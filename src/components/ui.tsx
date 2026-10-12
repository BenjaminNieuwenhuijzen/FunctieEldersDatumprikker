import type { ReactNode } from 'react';
import type { Venue } from '../lib/types';

/** Het routemotief: een lijn langs eerdere stops naar de volgende plek. */
export function RouteLine({ stops = 3, className = '' }: { stops?: number; className?: string }) {
  const w = 600;
  const pts = Array.from(
    { length: stops },
    (_, i) => 40 + (i * (w - 120)) / Math.max(stops - 1, 1),
  );
  return (
    <svg
      viewBox={`0 0 ${w} 60`}
      className={className}
      role="img"
      aria-label="Route langs eerdere etentjes naar het volgende restaurant"
    >
      <path
        d={`M0 40 C 120 40, 140 18, 240 24 S 400 44, ${w - 60} 30`}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="2"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      {pts.slice(0, -1).map((x, i) => (
        <circle
          key={i}
          cx={x}
          cy={30 + (i % 2 ? -6 : 8)}
          r="5"
          fill="var(--color-mist)"
          opacity="0.6"
        />
      ))}
      <circle cx={w - 60} cy="30" r="9" fill="var(--color-coral)" className="pulse-dot" />
    </svg>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-12 text-center sm:px-12">
      <RouteLine stops={2} className="mx-auto mb-6 w-full max-w-sm opacity-80" />
      <h3 className="text-2xl">{title}</h3>
      {children && <p className="mx-auto mt-3 max-w-md text-mist">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const PRICE = ['€', '€€', '€€€', '€€€€'];

export function VenueCard({ venue, index }: { venue: Venue; index: number }) {
  const hasDetails = venue.description || venue.cuisineTags.length || venue.priceBand;
  return (
    <article className="group flex flex-col justify-between rounded-3xl border border-line bg-ink p-6 sm:p-8">
      <div>
        <p
          className="font-display text-6xl font-extrabold text-line transition-colors group-hover:text-coral"
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, '0')}
        </p>
        <h3 className="mt-4 text-3xl">{venue.name}</h3>
        <p className="mt-1 text-mist">{venue.city}</p>
        {venue.description && <p className="mt-4">{venue.description}</p>}
        {!hasDetails && (
          <p className="mt-4 text-sm text-mist">
            Details volgen zodra de beheerder ze heeft geverifieerd.
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {venue.cuisineTags.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
        {venue.priceBand && (
          <span className="chip" aria-label={`Prijsklasse ${PRICE[venue.priceBand - 1]}`}>
            {PRICE[venue.priceBand - 1]}
          </span>
        )}
        {venue.websiteUrl && (
          <a
            className="ml-auto underline underline-offset-4 hover:text-coral"
            href={venue.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Officiële site
            <span className="sr-only"> van {venue.name} (opent in nieuw tabblad)</span>
          </a>
        )}
      </div>
    </article>
  );
}

export function ResultBar({
  label,
  value,
  max,
  tone = 'coral',
  highlight = false,
}: {
  label: string;
  value: number;
  max: number;
  tone?: 'coral' | 'yes' | 'maybe' | 'mist';
  highlight?: boolean;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const colors = { coral: 'bg-coral', yes: 'bg-yes', maybe: 'bg-maybe', mist: 'bg-mist' };
  return (
    <div className="flex items-center gap-3">
      <span className={`w-28 shrink-0 text-sm ${highlight ? 'font-semibold' : 'text-mist'}`}>
        {label}
      </span>
      <div
        className="h-3 flex-1 overflow-hidden rounded-full bg-raised"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className={`bar-fill h-full rounded-full ${colors[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right tabular-nums">{value}</span>
    </div>
  );
}
