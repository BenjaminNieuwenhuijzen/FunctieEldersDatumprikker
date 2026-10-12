import { useState, type FormEvent } from 'react';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { ActionError, useAction } from './AdminDashboard';
import { adminApi, slugify, type AdminEvent } from './adminApi';
import { EventEditor } from './EventEditor';

export const STATUS_LABEL: Record<AdminEvent['status'], string> = {
  draft: 'Concept',
  open: 'Open',
  closed: 'Gesloten',
  completed: 'Geweest',
};

export function EventsAdmin() {
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const events = useAsync(() => adminApi.listEvents(), [version]);
  const { busy, error, act } = useAction();
  const reload = () => setVersion((v) => v + 1);

  function create(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    void act(
      async () => {
        const ev = await adminApi.createEvent(t, slugify(t));
        setSelected(ev.id);
      },
      () => {
        setTitle('');
        reload();
      },
    );
  }

  if (events.status === 'loading') return <Loading />;
  if (events.status === 'error') return <ErrorNote message={events.message} />;
  const current = events.data.find((e) => e.id === selected) ?? null;

  return (
    <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
      <aside>
        <h2 className="text-2xl">Etentjes</h2>
        <ul className="mt-4 space-y-2">
          {events.data.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelected(e.id)}
                aria-current={e.id === selected}
                className={`w-full rounded-2xl border p-4 text-left ${e.id === selected ? 'border-coral bg-ink' : 'border-line hover:border-mist'}`}
              >
                <span className="block font-semibold">{e.title}</span>
                <span className="text-sm text-mist">{STATUS_LABEL[e.status]}</span>
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={create} className="mt-6 space-y-2">
          <label htmlFor="new-ev" className="block text-sm font-semibold">
            Nieuw etentje
          </label>
          <input
            id="new-ev"
            className="field"
            placeholder="Bijv. Het derde etentje"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn" disabled={busy || !title.trim()}>
            Aanmaken
          </button>
          <ActionError error={error} />
        </form>
      </aside>
      <section>
        {current ? (
          <EventEditor key={current.id} event={current} onChanged={reload} />
        ) : (
          <p className="text-mist">Kies links een etentje om te beheren.</p>
        )}
      </section>
    </div>
  );
}
