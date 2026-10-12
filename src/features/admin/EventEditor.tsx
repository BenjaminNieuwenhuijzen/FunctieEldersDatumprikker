import { useState, type FormEvent } from 'react';
import { describeDate, amsterdamToIso } from '../../lib/format';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import { ActionError, useAction } from './AdminDashboard';
import { adminApi, type AdminEvent } from './adminApi';
import { Attendance } from './Attendance';
import { STATUS_LABEL } from './EventsAdmin';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-ink p-5 sm:p-8">
      <h3 className="text-2xl">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function EventEditor({ event, onChanged }: { event: AdminEvent; onChanged: () => void }) {
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const data = useAsync(async () => {
    const [dates, venues, selected, exclusions] = await Promise.all([
      adminApi.listDateOptions(event.id),
      adminApi.listVenues(),
      adminApi.listEventVenueIds(event.id),
      adminApi.listExclusions(event.id),
    ]);
    return { dates, venues, selected, exclusions };
  }, [event.id, version]);
  const status = useAction();
  const [title, setTitle] = useState(event.title);
  const [copied, setCopied] = useState(false);
  const publicLink = `${location.origin}${import.meta.env.BASE_URL}#/event/${event.slug}`;

  function setEventStatus(next: AdminEvent['status']) {
    const ask: Partial<Record<AdminEvent['status'], string>> = {
      open: 'Poll openen? Iedereen met de link kan dan stemmen.',
      closed: 'Poll sluiten? Daarna kan niemand meer stemmen of aanpassen.',
      draft: 'Terug naar concept? De poll is dan niet meer publiek zichtbaar.',
    };
    if (ask[next] && !window.confirm(ask[next])) return;
    void status.act(() => adminApi.updateEvent(event.id, { status: next }), onChanged);
  }

  if (data.status === 'loading') return <Loading />;
  if (data.status === 'error') return <ErrorNote message={data.message} />;
  const { dates, venues, selected, exclusions } = data.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{STATUS_LABEL[event.status]}</p>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void status.act(
              () => adminApi.updateEvent(event.id, { title: title.trim() }),
              onChanged,
            );
          }}
        >
          <label htmlFor="ev-title" className="sr-only">
            Titel
          </label>
          <input
            id="ev-title"
            className="field max-w-md text-xl font-semibold"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn" disabled={status.busy || title.trim() === event.title}>
            Titel opslaan
          </button>
        </form>
      </div>

      <Panel title="Status">
        <div className="flex flex-wrap gap-2">
          {(['draft', 'open', 'closed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`btn ${event.status === s ? 'btn-primary' : ''}`}
              disabled={status.busy || event.status === s || event.status === 'completed'}
              onClick={() => setEventStatus(s)}
            >
              {s === 'draft' ? 'Concept' : s === 'open' ? 'Poll openen' : 'Poll sluiten'}
            </button>
          ))}
        </div>
        {event.status === 'open' && dates.length === 0 && (
          <p className="error-text mt-3">Let op: deze poll is open maar heeft nog geen datums.</p>
        )}
        <ActionError error={status.error} />
        {event.status !== 'draft' && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              className="field font-mono text-sm"
              value={publicLink}
              aria-label="Publieke link"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="btn shrink-0"
              onClick={() =>
                navigator.clipboard.writeText(publicLink).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
            >
              {copied ? 'Gekopieerd ✓' : 'Kopieer link'}
            </button>
          </div>
        )}
      </Panel>

      <DatesPanel eventId={event.id} dates={dates} onChanged={reload} />

      <Panel title="Restaurants in de stemming">
        <VenueToggles eventId={event.id} venues={venues} selected={selected} onChanged={reload} />
        <p className="mt-3 text-sm text-mist">"Geen voorkeur" staat er altijd automatisch bij.</p>
        {exclusions.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold">Bewust uitgesloten voor dit etentje</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {exclusions.map((x) => (
                <li key={x.id} className="chip" title={x.reason ?? undefined}>
                  {x.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel title="Uitslag en aanwezigheid">
        <Attendance eventId={event.id} dates={dates} venues={venues} />
      </Panel>

      {event.status === 'closed' && (
        <Panel title="Afronden: etentje is geweest">
          <CompleteForm
            event={event}
            venues={venues.filter((v) => selected.includes(v.id))}
            allVenues={venues}
            onDone={onChanged}
          />
        </Panel>
      )}
    </div>
  );
}

function DatesPanel({
  eventId,
  dates,
  onChanged,
}: {
  eventId: string;
  dates: Awaited<ReturnType<typeof adminApi.listDateOptions>>;
  onChanged: () => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:30');
  const [label, setLabel] = useState('');
  const { busy, error, act } = useAction();

  function add(e: FormEvent) {
    e.preventDefault();
    if (!date) return;
    void act(
      () => adminApi.addDateOption(eventId, date, time || null, label.trim()),
      () => {
        setDate('');
        setLabel('');
        onChanged();
      },
    );
  }

  return (
    <Panel title="Datumopties">
      {dates.length === 0 ? (
        <p className="text-mist">Nog geen datums. Voeg hieronder de eerste toe.</p>
      ) : (
        <ul className="space-y-2">
          {dates.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2"
            >
              <span>
                {describeDate({
                  id: d.id,
                  localDate: d.local_date,
                  startTime: d.start_time?.slice(0, 5),
                })}
                {d.label && <span className="text-mist"> · {d.label}</span>}
              </span>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Datum verwijderen? Antwoorden op deze datum vervallen ook.'))
                    void act(() => adminApi.deleteDateOption(d.id), onChanged);
                }}
              >
                Verwijderen
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-5 grid gap-3 sm:grid-cols-[1fr_8rem_1fr_auto]">
        <label className="text-sm">
          Datum
          <input
            type="date"
            className="field mt-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          Tijd
          <input
            type="time"
            className="field mt-1"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Label (optioneel)
          <input
            className="field mt-1"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <button className="btn self-end" disabled={busy || !date}>
          Toevoegen
        </button>
      </form>
      <ActionError error={error} />
    </Panel>
  );
}

function VenueToggles({
  eventId,
  venues,
  selected,
  onChanged,
}: {
  eventId: string;
  venues: Awaited<ReturnType<typeof adminApi.listVenues>>;
  selected: string[];
  onChanged: () => void;
}) {
  const { busy, error, act } = useAction();
  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {venues.map((v) => {
          const on = selected.includes(v.id);
          return (
            <li key={v.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--color-coral)]"
                  checked={on}
                  disabled={busy}
                  onChange={() =>
                    void act(() => adminApi.setEventVenue(eventId, v.id, !on), onChanged)
                  }
                />
                <span>
                  {v.name} <span className="text-mist">· {v.city}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <ActionError error={error} />
    </>
  );
}

function CompleteForm({
  event,
  venues,
  allVenues,
  onDone,
}: {
  event: AdminEvent;
  venues: Awaited<ReturnType<typeof adminApi.listVenues>>;
  allVenues: Awaited<ReturnType<typeof adminApi.listVenues>>;
  onDone: () => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venueId, setVenueId] = useState('');
  const [notes, setNotes] = useState('');
  const { busy, error, act } = useAction();
  const options = venues.length ? venues : allVenues;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!date || !venueId) return;
    if (!window.confirm('Etentje afronden en als bezoek in de geschiedenis zetten?')) return;
    void act(
      () =>
        adminApi.completeEvent(event, {
          visitedOn: date,
          startsAt: time ? amsterdamToIso(date, time) : null,
          venueId,
          notes: notes.trim(),
        }),
      onDone,
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-mist">
        Vul in waar en wanneer jullie <strong className="text-paper">werkelijk</strong> hebben
        gegeten. Dit wordt niet afgeleid uit de stemming.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Datum
          <input
            type="date"
            required
            className="field mt-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Tijd (optioneel)
          <input
            type="time"
            className="field mt-1"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Restaurant
          <select
            required
            className="field mt-1"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          >
            <option value="">Kies…</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Notitie (publiek zichtbaar in de geschiedenis)
        <textarea
          className="field mt-1 min-h-24"
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button className="btn btn-primary" disabled={busy || !date || !venueId}>
        Afronden
      </button>
      <ActionError error={error} />
    </form>
  );
}
