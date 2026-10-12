import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/supabaseApi';
import { signOut, useSession } from '../../lib/auth';
import { EmptyState } from '../../components/ui';
import { EmailGate } from '../../components/EmailGate';
import { Results } from '../availability/Results';
import { VoteForm } from '../availability/VoteForm';
import { ErrorNote, Loading, useAsync } from '../../lib/useAsync';
import type { PollEvent, PublicTally } from '../../lib/types';

/** Stemgedeelte voor een ingelogde deelnemer: laadt de eigen stem (indien aanwezig). */
function MyVote({
  event,
  email,
  onSaved,
}: {
  event: PollEvent;
  email: string;
  onSaved: () => void;
}) {
  const mine = useAsync(() => api.getMyVote(event.id), [event.id, email]);
  return (
    <div>
      <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist">
        <span>
          Ingelogd als <strong className="text-paper">{email}</strong>
        </span>
        <button
          type="button"
          className="underline underline-offset-4 hover:text-paper"
          onClick={() => void signOut()}
        >
          Uitloggen
        </button>
      </p>
      {mine.status === 'loading' && <Loading label="Je eerdere antwoord ophalen…" />}
      {mine.status === 'error' && <ErrorNote message={mine.message} />}
      {mine.status === 'ready' && (
        <>
          {mine.data.vote && (
            <p className="mb-6 rounded-2xl border border-line p-4">
              Je hebt al gestemd. Pas hieronder aan wat je wilt; je telt nog steeds één keer mee.
            </p>
          )}
          <VoteForm
            event={event}
            initial={mine.data.vote}
            defaultName={mine.data.lastDisplayName ?? ''}
            onSubmit={(p) => api.castVote(event.id, p)}
            onSaved={onSaved}
          />
        </>
      )}
    </div>
  );
}

export function EventPage() {
  const { slug = '' } = useParams();
  const session = useSession();
  const page = useAsync(() => api.getEventBySlug(slug), [slug]);
  const [tallyVersion, setTallyVersion] = useState(0);
  const eventId = page.status === 'ready' ? page.data?.id : undefined;
  const tally = useAsync<PublicTally | null>(
    async () => (eventId ? api.getTally(eventId) : null),
    [eventId, tallyVersion],
  );

  if (page.status === 'loading') return <Loading />;
  if (page.status === 'error')
    return (
      <main id="main" className="mx-auto max-w-4xl px-5 pt-8">
        <ErrorNote message={page.message} />
      </main>
    );
  const event = page.data;
  if (!event)
    return (
      <main id="main" className="mx-auto max-w-4xl px-5 pt-8">
        <EmptyState
          title="Dit etentje bestaat niet (meer)"
          action={
            <Link to="/" className="btn">
              Naar home
            </Link>
          }
        >
          Controleer de link, of vraag de organisator om een nieuwe.
        </EmptyState>
      </main>
    );

  return (
    <main id="main" className="mx-auto max-w-4xl px-5 pt-8">
      <p className="eyebrow">{event.status === 'open' ? 'Poll open' : 'Poll gesloten'}</p>
      <h1 className="h-section mt-2 text-4xl">{event.title}</h1>
      <div className="mt-10">
        {event.status !== 'open' ? (
          <p className="rounded-2xl border border-line p-4">
            Deze poll is gesloten. Stemmen of aanpassen is niet meer mogelijk.
          </p>
        ) : session.status === 'loading' ? (
          <Loading />
        ) : session.session ? (
          <MyVote
            event={event}
            email={session.session.user.email ?? ''}
            onSaved={() => setTallyVersion((v) => v + 1)}
          />
        ) : (
          <EmailGate />
        )}
      </div>
      <div className="mt-20">
        {tally.status === 'ready' && tally.data && <Results event={event} tally={tally.data} />}
        {tally.status === 'error' && <ErrorNote message={tally.message} />}
      </div>
    </main>
  );
}
