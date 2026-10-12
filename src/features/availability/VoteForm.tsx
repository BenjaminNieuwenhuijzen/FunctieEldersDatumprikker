import { useState, type FormEvent } from 'react';
import { capFirst, formatDateParts } from '../../lib/format';
import { NO_PREFERENCE, type Answer, type PollEvent, type VotePayload } from '../../lib/types';
import { LIMITS, validateVote, type VoteErrors } from '../../lib/validators';

const ANSWERS: { value: Answer; label: string; icon: string; cls: string }[] = [
  { value: 'yes', label: 'Ja', icon: '✓', cls: 'answer-yes' },
  { value: 'maybe', label: 'Misschien', icon: '?', cls: 'answer-maybe' },
  { value: 'no', label: 'Nee', icon: '✕', cls: 'answer-no' },
];

type Status = 'idle' | 'sending' | 'done';

interface Props {
  event: PollEvent;
  /**
   * Fase 1 (datumprikker op slot): alleen het restaurant. Fase 2 (open): alleen datums.
   * De aanroeper stuurt de stem naar de juiste functie.
   */
  onSubmit: (payload: VotePayload) => Promise<void>;
  /** Na succesvol opslaan, bijv. om de tussenstand te verversen. */
  onSaved?: () => void;
  /** Bestaande stem: het formulier wordt dan een wijziging. */
  initial?: VotePayload | null;
  /** Vooraf ingevulde naam (bijv. van een eerder etentje). */
  defaultName?: string;
}

/** Vergrendelde datumprikker in fase 1. */
export function LockedDates() {
  return (
    <section
      aria-labelledby="locked-h"
      className="relative overflow-hidden rounded-2xl border border-dashed border-line p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <svg viewBox="0 0 24 24" className="mt-1 h-7 w-7 shrink-0 text-mist" aria-hidden="true">
          <rect
            x="4"
            y="10"
            width="16"
            height="11"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div>
          <h3 id="locked-h" className="text-xl">
            Datumprikker zit nog op slot
          </h3>
          <p className="mt-1 text-mist">
            Eerst kiezen we samen het restaurant. Zodra dat vaststaat, gaat de datumprikker open en
            kun je hier aangeven wanneer je kunt.
          </p>
        </div>
      </div>
    </section>
  );
}

export function VoteForm({ event, onSubmit, onSaved, initial, defaultName = '' }: Props) {
  const datesPhase = event.datesOpen;
  const hasEarlier = datesPhase
    ? !!initial && Object.keys(initial.availability).length > 0
    : !!initial?.venueChoice;
  const [editing, setEditing] = useState(hasEarlier);
  const [name, setName] = useState(initial?.displayName ?? defaultName);
  const [availability, setAvailability] = useState<Record<string, Answer>>(
    initial?.availability ?? {},
  );
  const [venueChoice, setVenueChoice] = useState<string>(initial?.venueChoice ?? '');
  const [sName, setSName] = useState('');
  const [sReason, setSReason] = useState('');
  const [sUrl, setSUrl] = useState('');
  const [errors, setErrors] = useState<VoteErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [failure, setFailure] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload: VotePayload = {
      displayName: name.trim(),
      availability,
      venueChoice,
      suggestion: { name: sName.trim(), reason: sReason.trim(), url: sUrl.trim() },
    };
    const found = validateVote(
      payload,
      event.dateOptions,
      event.venues.map((v) => v.id),
      datesPhase ? 'dates' : 'venue',
    );
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!sName.trim() || datesPhase) delete payload.suggestion;
    setStatus('sending');
    setFailure('');
    try {
      await onSubmit(payload);
      setStatus('done');
      setSName('');
      setSReason('');
      setSUrl('');
      onSaved?.();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.');
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <div className="reveal rounded-3xl border border-yes/60 bg-ink p-6 sm:p-10" role="status">
        <p className="eyebrow text-yes">{editing ? 'Wijziging opgeslagen' : 'Stem ontvangen'}</p>
        <h3 className="h-section mt-2">Bedankt, {name.trim()}.</h3>
        <p className="mt-4 max-w-xl">
          {datesPhase
            ? 'Je beschikbaarheid is opgeslagen; je telt één keer mee.'
            : 'Je restaurantstem is opgeslagen. Zodra het restaurant vaststaat, gaat de datumprikker open en kun je je datums doorgeven.'}{' '}
          Aanpassen? Kom terug en log in met hetzelfde e-mailadres.
        </p>
        <button
          type="button"
          className="btn mt-6"
          onClick={() => {
            setEditing(true);
            setStatus('idle');
          }}
        >
          Nog iets aanpassen
        </button>
      </div>
    );
  }

  const closed = event.status !== 'open';
  return (
    <form onSubmit={submit} noValidate className="space-y-10" aria-describedby="privacy-note">
      <div>
        <label htmlFor="vf-name" className="block text-lg font-semibold">
          Hoe heet je?
        </label>
        <input
          id="vf-name"
          className="field mt-2 max-w-md"
          value={name}
          maxLength={LIMITS.name}
          autoComplete="given-name"
          placeholder="Schermnaam of voornaam"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'vf-name-err' : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && (
          <p id="vf-name-err" className="error-text mt-1">
            {errors.name}
          </p>
        )}
      </div>

      {!datesPhase && (
        <fieldset>
          <legend className="text-lg font-semibold">Waar wil je eten?</legend>
          <p className="text-sm text-mist">Kies één restaurant, of "geen voorkeur".</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ...event.venues.map((v) => ({ id: v.id, label: v.name })),
              { id: NO_PREFERENCE, label: 'Geen voorkeur' },
            ].map((o) => (
              <label key={o.id} className="answer answer-yes">
                <input
                  type="radio"
                  name="venue"
                  value={o.id}
                  checked={venueChoice === o.id}
                  onChange={() => setVenueChoice(o.id)}
                />
                <span>
                  <span aria-hidden="true">{venueChoice === o.id ? '●' : '○'}</span> {o.label}
                </span>
              </label>
            ))}
          </div>
          {errors.venue && <p className="error-text mt-2">{errors.venue}</p>}
        </fieldset>
      )}

      {datesPhase ? (
        <fieldset>
          <legend className="text-lg font-semibold">Wanneer kun je?</legend>
          <p className="text-sm text-mist">
            Je mag meerdere datums beantwoorden. Niets kiezen telt niet mee.
          </p>
          {event.dateOptions.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-line p-4 text-mist">
              De datums worden zo toegevoegd. Kom later nog even terug.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {event.dateOptions.map((d) => {
                const p = formatDateParts(d.localDate);
                return (
                  <div
                    key={d.id}
                    role="radiogroup"
                    aria-label={`Beschikbaarheid ${p.long}`}
                    className="rounded-2xl border border-line bg-ink p-4"
                  >
                    <p className="mb-3 flex items-baseline gap-3">
                      <span className="font-display text-4xl font-extrabold">{p.day}</span>
                      <span>
                        {capFirst(p.weekday)}{' '}
                        <span className="text-mist">
                          {p.month}
                          {d.startTime ? ` · ${d.startTime}` : ''}
                        </span>
                      </span>
                    </p>
                    <div className="flex gap-2">
                      {ANSWERS.map((a) => (
                        <label key={a.value} className={`answer ${a.cls}`}>
                          <input
                            type="radio"
                            name={`date-${d.id}`}
                            value={a.value}
                            checked={availability[d.id] === a.value}
                            onChange={() => setAvailability((s) => ({ ...s, [d.id]: a.value }))}
                          />
                          <span>
                            <span aria-hidden="true">{a.icon}</span> {a.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {errors.availability && <p className="error-text mt-2">{errors.availability}</p>}
        </fieldset>
      ) : (
        <LockedDates />
      )}

      {!datesPhase && !editing && (
        <details className="rounded-2xl border border-line bg-ink p-4">
          <summary className="cursor-pointer font-semibold">
            Heb je zelf een restaurantidee? (optioneel)
          </summary>
          <p className="mt-2 text-sm text-mist">
            Dit is een suggestie. Het wordt niet automatisch een optie in deze poll; de beheerder
            beoordeelt het.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              className="field"
              aria-label="Naam restaurant"
              placeholder="Naam restaurant"
              maxLength={LIMITS.suggestionName}
              value={sName}
              onChange={(e) => setSName(e.target.value)}
            />
            <input
              className="field"
              aria-label="Waarom dit restaurant?"
              placeholder="Waarom past het bij ons?"
              maxLength={LIMITS.reason}
              value={sReason}
              onChange={(e) => setSReason(e.target.value)}
            />
            <input
              className="field"
              aria-label="Link (https://…)"
              placeholder="Link (https://…)"
              inputMode="url"
              maxLength={LIMITS.url}
              value={sUrl}
              onChange={(e) => setSUrl(e.target.value)}
            />
          </div>
          {errors.suggestion && <p className="error-text mt-2">{errors.suggestion}</p>}
        </details>
      )}

      <div>
        {failure && (
          <p className="error-text mb-3" role="alert">
            {failure}
          </p>
        )}
        <button
          className="btn btn-primary"
          disabled={
            status === 'sending' || closed || (datesPhase && event.dateOptions.length === 0)
          }
        >
          {closed
            ? 'Poll is gesloten'
            : status === 'sending'
              ? 'Versturen…'
              : editing
                ? 'Wijziging opslaan'
                : datesPhase
                  ? 'Verstuur mijn beschikbaarheid'
                  : 'Verstuur mijn restaurantstem'}
        </button>
        <p id="privacy-note" className="mt-4 max-w-xl text-sm text-mist">
          Je naam en antwoorden zijn niet publiek: iedereen ziet alleen totalen. Je telt één keer
          mee per e-mailadres. Iemand met twee e-mailadressen kan in theorie twee keer stemmen; de
          beheerder kan dubbele inzendingen opruimen.
        </p>
      </div>
    </form>
  );
}
