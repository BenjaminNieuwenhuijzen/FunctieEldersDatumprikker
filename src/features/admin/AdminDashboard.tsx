import { useState } from 'react';
import { signOut } from '../../lib/auth';
import { EventsAdmin } from './EventsAdmin';
import { VenuesAdmin } from './VenuesAdmin';
import { SuggestionsAdmin } from './SuggestionsAdmin';
import { SettingsAdmin } from './SettingsAdmin';

const TABS = [
  { id: 'events', label: 'Etentjes' },
  { id: 'venues', label: 'Restaurants' },
  { id: 'suggestions', label: 'Suggesties' },
  { id: 'settings', label: 'Instellingen' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function AdminDashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('events');
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Beheeronderdelen" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              className={`btn ${tab === t.id ? 'btn-primary' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-mist">
          {email} ·{' '}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-paper"
            onClick={() => void signOut()}
          >
            Uitloggen
          </button>
        </p>
      </div>
      <div className="mt-10" role="tabpanel">
        {tab === 'events' && <EventsAdmin />}
        {tab === 'venues' && <VenuesAdmin />}
        {tab === 'suggestions' && <SuggestionsAdmin />}
        {tab === 'settings' && <SettingsAdmin />}
      </div>
    </div>
  );
}

/** Kleine helper voor knoppen die een async actie uitvoeren met nette fout-/bezig-status. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError('');
    try {
      await fn();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, act };
}

export function ActionError({ error }: { error: string }) {
  return error ? (
    <p className="error-text mt-2" role="alert">
      {error}
    </p>
  ) : null;
}
