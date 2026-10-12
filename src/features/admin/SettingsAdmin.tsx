import { useState } from 'react';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { ActionError, useAction } from './AdminDashboard';
import { adminApi } from './adminApi';

export function SettingsAdmin() {
  const [version, setVersion] = useState(0);
  const enabled = useAsync(() => adminApi.getSubmissionsEnabled(), [version]);
  const toggle = useAction();
  const purge = useAction();
  const [days, setDays] = useState(90);
  const [purged, setPurged] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-line bg-ink p-5 sm:p-8">
        <h2 className="text-2xl">Noodstop</h2>
        <p className="mt-2 max-w-2xl text-mist">
          Zet alle publieke inzendingen (stemmen, wijzigingen, ideeën) direct uit, bijvoorbeeld bij
          spam. Lezen blijft werken.
        </p>
        {enabled.status === 'loading' && <Loading />}
        {enabled.status === 'error' && <ErrorNote message={enabled.message} />}
        {enabled.status === 'ready' && (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <p>
              Inzendingen staan{' '}
              <strong className={enabled.data ? 'text-yes' : 'text-coral'}>
                {enabled.data ? 'aan' : 'uit'}
              </strong>
              .
            </p>
            <button
              type="button"
              className={`btn ${enabled.data ? '' : 'btn-primary'}`}
              disabled={toggle.busy}
              onClick={() =>
                void toggle.act(
                  () => adminApi.setSubmissionsEnabled(!enabled.data),
                  () => setVersion((v) => v + 1),
                )
              }
            >
              {enabled.data ? 'Inzendingen uitzetten' : 'Inzendingen weer aanzetten'}
            </button>
          </div>
        )}
        <ActionError error={toggle.error} />
      </section>

      <section className="rounded-3xl border border-line bg-ink p-5 sm:p-8">
        <h2 className="text-2xl">Persoonsgegevens opschonen</h2>
        <p className="mt-2 max-w-2xl text-mist">
          Verwijdert namen en stemdetails van afgeronde etentjes die langer dan het gekozen aantal
          dagen geleden zijn afgerond, plus e-mailaccounts die nergens meer aan gekoppeld zijn.
          Bezoekhistorie (restaurant + datum) blijft bestaan.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Ouder dan (dagen)
            <input
              type="number"
              min={0}
              max={3650}
              className="field mt-1 w-32"
              value={days}
              onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={purge.busy}
            onClick={() => {
              if (
                !window.confirm(`Persoonsgegevens ouder dan ${days} dagen definitief verwijderen?`)
              )
                return;
              void purge.act(async () => setPurged(await adminApi.purge(days)));
            }}
          >
            Opschonen
          </button>
        </div>
        {purged !== null && (
          <p className="mt-3" role="status">
            {purged} deelnemer{purged === 1 ? '' : 's'} verwijderd.
          </p>
        )}
        <ActionError error={purge.error} />
      </section>
    </div>
  );
}
