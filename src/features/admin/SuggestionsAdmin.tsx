import { useState } from 'react';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { ActionError, useAction } from './AdminDashboard';
import { adminApi, type AdminSuggestion } from './adminApi';

const LABEL: Record<AdminSuggestion['status'], string> = {
  pending: 'Te beoordelen',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  duplicate: 'Duplicaat',
};

export function SuggestionsAdmin() {
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<AdminSuggestion['status'] | 'all'>('pending');
  const list = useAsync(() => adminApi.listSuggestions(), [version]);
  const { busy, error, act } = useAction();

  if (list.status === 'loading') return <Loading />;
  if (list.status === 'error') return <ErrorNote message={list.message} />;
  const rows = list.data.filter((s) => filter === 'all' || s.status === filter);

  return (
    <div>
      <h2 className="text-2xl">Restaurantideeën</h2>
      <p className="mt-2 max-w-2xl text-mist">
        Ideeën van deelnemers. Ze zijn pas publiek na goedkeuring en worden nooit automatisch een
        optie in een lopende stemming. Voeg een goedgekeurd idee zelf toe aan de catalogus.
      </p>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter">
        {(['pending', 'approved', 'rejected', 'duplicate', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className={`btn ${filter === f ? 'btn-primary' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Alles' : LABEL[f]}
          </button>
        ))}
      </div>
      <ActionError error={error} />
      {rows.length === 0 ? (
        <p className="mt-8 text-mist">Niets in deze lijst.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="rounded-2xl border border-line bg-ink p-5">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-xl font-semibold">{s.suggested_name}</span>
                <span className="chip">{LABEL[s.status]}</span>
              </p>
              {s.reason && <p className="mt-2">{s.reason}</p>}
              <p className="mt-2 text-sm text-mist">
                {s.submitted_by_label ? `Door ${s.submitted_by_label} · ` : ''}
                {new Date(s.created_at).toLocaleDateString('nl-NL', {
                  timeZone: 'Europe/Amsterdam',
                })}
                {s.url && (
                  <>
                    {' · '}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      link
                    </a>
                  </>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(['approved', 'rejected', 'duplicate'] as const)
                  .filter((st) => st !== s.status)
                  .map((st) => (
                    <button
                      key={st}
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => adminApi.setSuggestionStatus(s.id, st),
                          () => setVersion((v) => v + 1),
                        )
                      }
                    >
                      {st === 'approved'
                        ? 'Goedkeuren'
                        : st === 'rejected'
                          ? 'Afwijzen'
                          : 'Duplicaat'}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
