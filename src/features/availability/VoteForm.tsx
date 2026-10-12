import { useState, type FormEvent } from 'react';
import { formatDateParts } from '../../lib/format';
import {
  NO_PREFERENCE,
  type Answer,
  type PollEvent,
  type VotePayload,
  type VoteReceipt,
} from '../../lib/types';
import { LIMITS, validateVote, type VoteErrors } from '../../lib/validators';

const ANSWERS: { value: Answer; label: string; icon: string; cls: string }[] = [
  { value: 'yes', label: 'Ja', icon: '✓', cls: 'answer-yes' },
  { value: 'maybe', label: 'Misschien', icon: '?', cls: 'answer-maybe' },
  { value: 'no', label: 'Nee', icon: '✕', cls: 'answer-no' },
];

type Phase = 'idle' | 'sending' | 'done';

interface Props {
  event: PollEvent;
  onSubmit: (payload: VotePayload) => Promise<VoteReceipt>;
  /** Alleen demo: geen echte bewerklink tonen. */
  demo?: boolean;
}

export function editLink(token: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#/edit/${token}`;
}

export function VoteForm({ event, onSubmit, demo = false }: Props) {
  const [name, setName] = useState('');
  const [availability, setAvailability] = useState<Record<string, Answer>>({});
  const [venueChoice, setVenueChoice] = useState('');
  const [sName, setSName] = useState('');
  const [sReason, setSReason] = useState('');
  const [sUrl, setSUrl] = useState('');
  const [errors, setErrors] = useState<VoteErrors>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState('');
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null);
  const [copied, setCopied] = useState(false);

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
    );
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!sName) delete payload.suggestion;
    setPhase('sending');
    setFailure('');
    try {
      setReceipt(await onSubmit(payload));
      setPhase('done');
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Er ging iets mis. Probeer het opnieuw.');
      setPhase('idle');
    }
  }

  if (phase === 'done' && receipt) {
    const link = editLink(receipt.editToken);
    return (
      <div className="reveal rounded-3xl border border-yes/60 bg-ink p-6 sm:p-10" role="status">
        <p className="eyebrow text-yes">Stem ontvangen</p>
        <h3 className="h-section mt-2">Bedankt, {name.trim()}.</h3>
        <p className="mt-4 max-w-xl">
          Bewaar deze persoonlijke link. Daarmee kun je je antwoord later aanpassen zonder dubbel te
          tellen. Raak je de link kwijt, dan kan alleen de beheerder je stem herstellen.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            className="field font-mono text-sm"
            value={link}
            aria-label="Je persoonlijke bewerklink"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="btn btn-primary shrink-0"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Gekopieerd ✓' : 'Kopieer link'}
          </button>
        </div>
        {demo && <p className="mt-3 text-sm text-mist">Demo: deze link werkt niet echt.</p>}
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

      <fieldset>
        <legend className="text-lg font-semibold">Wanneer kun je?</legend>
        <p className="text-sm text-mist">
          Je mag meerdere datums beantwoorden. Niets kiezen telt niet mee.
        </p>
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
                  <span className="capitalize">
                    {p.weekday}{' '}
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
        {errors.availability && <p className="error-text mt-2">{errors.availability}</p>}
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">Waar wil je eten?</legend>
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

      <div>
        {failure && (
          <p className="error-text mb-3" role="alert">
            {failure}
          </p>
        )}
        <button className="btn btn-primary" disabled={phase === 'sending' || closed}>
          {closed ? 'Poll is gesloten' : phase === 'sending' ? 'Versturen…' : 'Verstuur mijn stem'}
        </button>
        <p id="privacy-note" className="mt-4 max-w-xl text-sm text-mist">
          Je naam en antwoorden zijn niet publiek: iedereen ziet alleen totalen. Er is geen account;
          dat betekent ook dat "één stem per persoon" niet waterdicht is. De beheerder kan dubbele
          inzendingen opruimen.
        </p>
      </div>
    </form>
  );
}
