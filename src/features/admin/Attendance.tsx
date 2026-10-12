import { useState } from 'react';
import { capFirst, formatDateParts } from '../../lib/format';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import type { Answer } from '../../lib/types';
import { ActionError, useAction } from './AdminDashboard';
import { adminApi, type AdminDateOption, type AdminParticipant, type AdminVenue } from './adminApi';

const MARK: Record<Answer, { icon: string; label: string; cls: string }> = {
  yes: { icon: '✓', label: 'Ja', cls: 'text-yes' },
  maybe: { icon: '?', label: 'Misschien', cls: 'text-maybe' },
  no: { icon: '✕', label: 'Nee', cls: 'text-no' },
};

function toCsv(rows: AdminParticipant[], dates: AdminDateOption[], venues: AdminVenue[]): string {
  const venueName = (id: string | null) =>
    id === 'none' || !id ? 'Geen voorkeur' : (venues.find((v) => v.id === id)?.name ?? id);
  // Voorkomt formule-injectie in Excel/Sheets: namen komen van deelnemers.
  const esc = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  const head = [
    'Naam',
    'E-mail',
    ...dates.map((d) => d.local_date),
    'Restaurant',
    'Laatst gewijzigd',
  ];
  const body = rows.map((p) => [
    p.displayName,
    p.email,
    ...dates.map((d) => {
      const a = p.availability[d.id];
      return a ? MARK[a].label : '';
    }),
    venueName(p.venueChoice),
    p.updatedAt,
  ]);
  return [head, ...body].map((r) => r.map((c) => esc(String(c))).join(';')).join('\r\n');
}

/** Alleen voor beheerders: individuele antwoorden. Deze data is nooit publiek. */
export function Attendance({
  eventId,
  dates,
  venues,
}: {
  eventId: string;
  dates: AdminDateOption[];
  venues: AdminVenue[];
}) {
  const [version, setVersion] = useState(0);
  const people = useAsync(() => adminApi.listParticipants(eventId), [eventId, version]);
  const { busy, error, act } = useAction();

  if (people.status === 'loading') return <Loading />;
  if (people.status === 'error') return <ErrorNote message={people.message} />;
  const rows = people.data;
  if (rows.length === 0) return <p className="text-mist">Nog geen stemmen.</p>;

  const venueName = (id: string | null) =>
    id === 'none' || !id ? 'Geen voorkeur' : (venues.find((v) => v.id === id)?.name ?? '—');
  const totals = dates.map((d) => ({
    id: d.id,
    yes: rows.filter((p) => p.availability[d.id] === 'yes').length,
    maybe: rows.filter((p) => p.availability[d.id] === 'maybe').length,
  }));

  function exportCsv() {
    const blob = new Blob(['﻿' + toCsv(rows, dates, venues)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aanwezigheid-${eventId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <caption className="sr-only">Aanwezigheid per deelnemer en datum</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-4">
                Deelnemer
              </th>
              {dates.map((d) => (
                <th key={d.id} scope="col" className="px-2 py-2 text-center">
                  {capFirst(formatDateParts(d.local_date).short)}
                </th>
              ))}
              <th scope="col" className="px-2 py-2">
                Restaurant
              </th>
              <th scope="col" className="py-2">
                <span className="sr-only">Acties</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line/60">
                <th scope="row" className="py-2 pr-4 font-normal">
                  <span className="font-semibold">{p.displayName}</span>
                  <span className="block text-xs text-mist">{p.email}</span>
                </th>
                {dates.map((d) => {
                  const a = p.availability[d.id];
                  return (
                    <td key={d.id} className="px-2 py-2 text-center">
                      {a ? (
                        <span className={`font-bold ${MARK[a].cls}`} title={MARK[a].label}>
                          {MARK[a].icon}
                          <span className="sr-only">{MARK[a].label}</span>
                        </span>
                      ) : (
                        <span className="text-mist" aria-label="geen antwoord">
                          ·
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2">{venueName(p.venueChoice)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="text-mist underline underline-offset-4 hover:text-coral"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Stem van ${p.displayName} verwijderen?`))
                        void act(
                          () => adminApi.deleteParticipant(p.id),
                          () => setVersion((v) => v + 1),
                        );
                    }}
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-2 pr-4 text-mist">
                Ja / misschien
              </th>
              {totals.map((t) => (
                <td key={t.id} className="px-2 py-2 text-center tabular-nums">
                  {t.yes} / {t.maybe}
                </td>
              ))}
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      <ActionError error={error} />
      <button type="button" className="btn mt-5" onClick={exportCsv}>
        Exporteer CSV
      </button>
    </div>
  );
}
